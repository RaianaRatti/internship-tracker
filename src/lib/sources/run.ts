import fs from "node:fs";
import YAML from "yaml";
import { and, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { SourceAdapter, NormalizedPosting, CompanyConfig } from "./types";
import { greenhouse } from "./greenhouse";
import { lever } from "./lever";
import { ashby } from "./ashby";
import { smartrecruiters } from "./smartrecruiters";
import { workday } from "./workday";
import { simplify } from "./simplify";
import { amazon } from "./amazon";
import { google } from "./google";
import { dedupeKey } from "../core/text";
import { scoreFit, type FitContext } from "../core/fit";
import { getPreferences, getProfile } from "../settings";

export const ADAPTERS: SourceAdapter[] = [simplify, greenhouse, lever, ashby, smartrecruiters, workday, amazon, google];

/** Seed the company registry and source rows on first run. */
export async function ensureSeeded() {
  const existing = await db.select({ id: schema.companies.id }).from(schema.companies).limit(1);
  if (!existing.length && fs.existsSync("data/companies.yaml")) {
    const doc = YAML.parse(fs.readFileSync("data/companies.yaml", "utf8")) as {
      companies: { name: string; ats: string; board?: string }[];
    };
    await db
      .insert(schema.companies)
      .values(doc.companies.map((c) => ({ name: c.name, ats: c.ats, boardId: c.board ?? null })))
      .onConflictDoNothing();
  }
  for (const a of ADAPTERS) {
    await db.insert(schema.sources).values({ id: a.id, enabled: true }).onConflictDoNothing();
  }
  await db.insert(schema.sources).values({ id: "email-alert", enabled: true }).onConflictDoNothing();
  await db.insert(schema.sources).values({ id: "manual", enabled: true }).onConflictDoNothing();
}

export async function buildFitContext(): Promise<FitContext> {
  const [prefs, profile, skills, companies] = await Promise.all([
    getPreferences(),
    getProfile(),
    db.select({ name: schema.skills.name }).from(schema.skills),
    db.select({ name: schema.companies.name, tier: schema.companies.tier }).from(schema.companies),
  ]);
  return {
    prefs,
    skills: skills.map((s) => s.name.toLowerCase()),
    companyTiers: new Map(companies.filter((c) => c.tier).map((c) => [c.name.toLowerCase(), c.tier!])),
    needsSponsorship: !!profile.needsSponsorship,
  };
}

/** `ids` are the rows each posting landed in: new, updated, or the existing duplicate. */
export type UpsertResult = { inserted: number; updated: number; skippedDuplicates: number; closed: number; ids: number[] };

/** Insert or update normalized postings, deduplicating across sources (PLAN.md §5). */
export async function upsertPostings(postings: NormalizedPosting[], sourceId: string, ctx?: FitContext): Promise<UpsertResult> {
  ctx ??= await buildFitContext();
  const res: UpsertResult = { inserted: 0, updated: 0, skippedDuplicates: 0, closed: 0, ids: [] };
  const companies = await db.select({ id: schema.companies.id, name: schema.companies.name }).from(schema.companies);
  const companyIdByName = new Map(companies.map((c) => [c.name.toLowerCase(), c.id]));

  for (const p of postings) {
    const key = dedupeKey(p.org, p.title);
    const fit = scoreFit({ ...p, type: p.type }, ctx);
    const existing = await db.query.opportunities.findFirst({ where: eq(schema.opportunities.externalKey, p.externalKey) });

    if (existing) {
      const closing = p.active === false && !existing.closedAt;
      await db
        .update(schema.opportunities)
        .set({
          title: p.title,
          location: p.location ?? existing.location,
          description: p.description || existing.description,
          deadline: p.deadline ?? existing.deadline,
          closedAt: p.active === false ? (existing.closedAt ?? new Date()) : null,
          // Don't overwrite an AI re-rank with the heuristic score.
          ...(existing.fitReason?.startsWith("AI:") ? {} : { fitScore: fit.score, fitReason: fit.reason }),
        })
        .where(eq(schema.opportunities.id, existing.id));
      res.updated++;
      if (closing) res.closed++;
      res.ids.push(existing.id);
      continue;
    }
    if (p.active === false) continue; // never insert postings that are already closed

    // Same role already known from another source? Keep the first one (ATS sources usually have richer data).
    const sameKey = or(eq(schema.opportunities.dedupeKey, key), ...(p.url ? [eq(schema.opportunities.url, p.url), eq(schema.opportunities.applyUrl, p.url)] : []));
    const dup = await db.query.opportunities.findFirst({
      where: and(sameKey, ne(schema.opportunities.externalKey, p.externalKey)),
    });
    if (dup) {
      if (!dup.description && p.description) {
        await db.update(schema.opportunities).set({ description: p.description }).where(eq(schema.opportunities.id, dup.id));
      }
      res.skippedDuplicates++;
      res.ids.push(dup.id); // callers (manual add, clipper) get the existing row back
      continue;
    }

    const [row] = await db
      .insert(schema.opportunities)
      .values({
        externalKey: p.externalKey,
        type: p.type,
        title: p.title,
        org: p.org,
        companyId: companyIdByName.get(p.org.toLowerCase()) ?? null,
        location: p.location ?? null,
        remote: !!p.remote,
        season: p.season ?? null,
        deadline: p.deadline ?? null,
        url: p.url ?? null,
        applyUrl: p.applyUrl ?? p.url ?? null,
        ats: p.ats ?? null,
        description: p.description ?? null,
        compensation: p.compensation ?? null,
        sourceId,
        postedAt: p.postedAt ?? null,
        fitScore: fit.score,
        fitReason: fit.reason,
        dedupeKey: key,
      })
      .returning({ id: schema.opportunities.id });
    res.inserted++;
    res.ids.push(row.id);
  }
  return res;
}

export type RunSummary = { source: string; ok: boolean; message: string; inserted: number; updated: number };

/** Run every enabled adapter once (the worker calls this on a schedule; the UI has a "Sync now" button). */
export async function runDiscovery(opts: { only?: string[] } = {}): Promise<RunSummary[]> {
  await ensureSeeded();
  const ctx = await buildFitContext();
  const enabled = new Set(
    (await db.select().from(schema.sources).where(eq(schema.sources.enabled, true))).map((s) => s.id),
  );
  const summaries: RunSummary[] = [];

  for (const adapter of ADAPTERS) {
    if (!enabled.has(adapter.id)) continue;
    if (opts.only && !opts.only.includes(adapter.id)) continue;

    let total = { inserted: 0, updated: 0 };
    const errors: string[] = [];
    if (adapter.scope === "global") {
      try {
        const r = await upsertPostings(await adapter.fetch({ seasons: ctx.prefs.seasons }), adapter.id, ctx);
        total = { inserted: r.inserted, updated: r.updated };
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    } else {
      const companies = await db
        .select()
        .from(schema.companies)
        .where(and(eq(schema.companies.ats, adapter.id)));
      for (const c of companies) {
        if (!c.boardId) continue;
        try {
          const postings = await adapter.fetch({ company: c as CompanyConfig, seasons: ctx.prefs.seasons });
          const r = await upsertPostings(postings, adapter.id, ctx);
          total.inserted += r.inserted;
          total.updated += r.updated;
          await noteWatchlist(c, postings.length);
        } catch (e) {
          errors.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
    const ok = errors.length === 0;
    const message = ok ? `+${total.inserted} new, ${total.updated} updated` : `${errors.length} error(s): ${errors.slice(0, 3).join("; ")}`;
    await db
      .update(schema.sources)
      .set({ lastRunAt: new Date(), lastStatus: message, lastCount: total.inserted })
      .where(eq(schema.sources.id, adapter.id));
    summaries.push({ source: adapter.id, ok, message, ...total });
  }
  await collapseUrlDuplicates();
  return summaries;
}

/**
 * Sources sometimes title the same posting differently (e.g. a curated list vs the ATS), so
 * title-based dedupe misses them. Drop untracked copies that share a URL with an older row.
 */
export async function collapseUrlDuplicates() {
  await db.run(sql`
    delete from opportunities
    where url is not null
      and id not in (select opportunity_id from applications)
      and exists (select 1 from opportunities o2 where o2.url = opportunities.url and o2.id < opportunities.id)`);
}

/** Watchlist (PLAN.md §3.3): remind the student when a watched company opens student roles. */
async function noteWatchlist(c: typeof schema.companies.$inferSelect, openCount: number) {
  if (c.watch && (c.lastOpenCount ?? 0) === 0 && openCount > 0) {
    await db.insert(schema.reminders).values({ dueAt: new Date(), text: `${c.name} just opened ${openCount} student role(s)!` });
  }
  await db.update(schema.companies).set({ lastCheckedAt: new Date(), lastOpenCount: openCount }).where(eq(schema.companies.id, c.id));
}

/** Recompute heuristic fit for everything not yet AI-ranked (after preferences or vault change). */
export async function rescoreAll() {
  const ctx = await buildFitContext();
  const opps = await db.select().from(schema.opportunities).where(isNull(schema.opportunities.closedAt));
  for (const o of opps) {
    if (o.fitReason?.startsWith("AI:")) continue;
    const fit = scoreFit(o, ctx);
    await db.update(schema.opportunities).set({ fitScore: fit.score, fitReason: fit.reason }).where(inArray(schema.opportunities.id, [o.id]));
  }
}
