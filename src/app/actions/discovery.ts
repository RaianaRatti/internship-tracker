"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { runDiscovery, rescoreAll } from "@/lib/sources/run";
import { detectAts } from "@/lib/sources/detect";
import { rerankOpportunities } from "@/lib/ai/rank";
import { describeAiError } from "@/lib/ai/client";
import { back, errMsg, str } from "./util";

export async function syncNow(fd: FormData) {
  const only = str(fd, "only");
  const results = await runDiscovery({ only: only ? only.split(",") : undefined });
  const added = results.reduce((n, r) => n + r.inserted, 0);
  const failed = results.filter((r) => !r.ok).map((r) => r.source);
  back(str(fd, "from") ?? "/quests", `Synced ${results.length} sources: +${added} new${failed.length ? ` · problems: ${failed.join(", ")}` : ""}`, failed.length ? "err" : "ok");
}

export async function rerankTop() {
  const top = await db
    .select({ id: schema.opportunities.id })
    .from(schema.opportunities)
    .where(and(isNull(schema.opportunities.closedAt), eq(schema.opportunities.hidden, false)))
    .orderBy(desc(schema.opportunities.fitScore))
    .limit(25);
  try {
    const n = await rerankOpportunities(top.map((t) => t.id));
    back("/quests?sort=fit", `AI re-ranked ${n} top matches`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    back("/quests", describeAiError(e), "err");
  }
}

export async function addCompany(fd: FormData) {
  const name = str(fd, "name");
  if (!name) back("/settings?tab=companies", "Company name is required", "err");
  const careersUrl = str(fd, "careersUrl");
  let ats = str(fd, "ats");
  let boardId = str(fd, "boardId");
  let note = "";
  if (!ats || !boardId) {
    try {
      const found = await detectAts(name!, careersUrl);
      if (found) {
        ats = found.ats;
        boardId = found.boardId;
        note = ` · detected ${found.ats} board "${found.boardId}"`;
      } else note = " · no public ATS found; it will be covered by curated lists and job alerts";
    } catch (e) {
      note = ` · ATS detection failed: ${errMsg(e)}`;
    }
  }
  await db
    .insert(schema.companies)
    .values({ name: name!, careersUrl, ats: ats ?? "none", boardId, tier: str(fd, "tier"), watch: fd.get("watch") === "on" })
    .onConflictDoUpdate({
      target: schema.companies.name,
      set: { careersUrl, ats: ats ?? "none", boardId, tier: str(fd, "tier"), watch: fd.get("watch") === "on" },
    });
  await rescoreAll();
  back("/settings?tab=companies", `Saved ${name}${note}`);
}

export async function updateCompany(id: number, fd: FormData) {
  await db
    .update(schema.companies)
    .set({ tier: str(fd, "tier"), watch: fd.get("watch") === "on" })
    .where(eq(schema.companies.id, id));
  await rescoreAll();
  revalidatePath("/settings");
}

export async function deleteCompany(id: number) {
  await db.delete(schema.companies).where(eq(schema.companies.id, id));
  revalidatePath("/settings");
}

export async function toggleSource(id: string, enabled: boolean) {
  await db.update(schema.sources).set({ enabled }).where(eq(schema.sources.id, id));
  revalidatePath("/settings");
}
