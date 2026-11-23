import { and, eq, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Status } from "@/db/schema";
import { canAutoTransition, STATUS_LABEL } from "./core/status";
import { getPreferences } from "./settings";

export async function trackOpportunity(opportunityId: number, status: Status = "saved") {
  const existing = await db.query.applications.findFirst({ where: eq(schema.applications.opportunityId, opportunityId) });
  if (existing) return existing;
  const [app] = await db
    .insert(schema.applications)
    .values({ opportunityId, status, appliedAt: status === "applied" ? new Date() : null })
    .returning();
  await db.insert(schema.applicationEvents).values({
    applicationId: app.id,
    kind: "status_change",
    title: `Added as ${STATUS_LABEL[status]}`,
    origin: "user",
  });
  return app;
}

/**
 * Change status and record it on the timeline. `auto` changes (Gmail, system) obey the
 * forward-only rule; manual changes are always allowed.
 */
export async function setStatus(
  applicationId: number,
  to: Status,
  opts: { origin?: "user" | "gmail" | "system"; detail?: string; when?: Date } = {},
): Promise<boolean> {
  const origin = opts.origin ?? "user";
  const app = await db.query.applications.findFirst({ where: eq(schema.applications.id, applicationId) });
  if (!app || app.status === to) return false;
  if (origin !== "user" && !canAutoTransition(app.status, to)) return false;

  const when = opts.when ?? new Date();
  await db
    .update(schema.applications)
    .set({
      status: to,
      statusChangedAt: when,
      // Anything past "applied" implies the student applied, even if they skipped that column.
      appliedAt: !app.appliedAt && !["saved", "preparing", "withdrawn"].includes(to) ? when : app.appliedAt,
    })
    .where(eq(schema.applications.id, applicationId));
  const source = origin === "gmail" ? `, detected from email` : origin === "system" ? " (automatic)" : "";
  await db.insert(schema.applicationEvents).values({
    applicationId,
    kind: "status_change",
    title: `${STATUS_LABEL[app.status]} → ${STATUS_LABEL[to]}${source}`,
    detail: opts.detail ?? null,
    origin,
    occurredAt: when,
  });
  return true;
}

/** Applied with no news for N days -> Ghosted; also queue follow-up reminders (PLAN.md §3.4). */
export async function runHousekeeping() {
  const prefs = await getPreferences();
  const now = Date.now();
  const ghostCutoff = new Date(now - prefs.ghostDays * 86400_000);
  const stale = await db
    .select()
    .from(schema.applications)
    .where(and(eq(schema.applications.status, "applied"), lt(schema.applications.statusChangedAt, ghostCutoff)));
  for (const a of stale) {
    await setStatus(a.id, "ghosted", { origin: "system", detail: `No response in ${prefs.ghostDays} days` });
  }

  const followCutoff = new Date(now - prefs.followUpDays * 86400_000);
  const needFollow = await db
    .select()
    .from(schema.applications)
    .where(and(eq(schema.applications.status, "applied"), lt(schema.applications.statusChangedAt, followCutoff)));
  if (needFollow.length) {
    const existing = await db
      .select({ applicationId: schema.reminders.applicationId })
      .from(schema.reminders)
      .where(inArray(schema.reminders.applicationId, needFollow.map((a) => a.id)));
    const has = new Set(existing.map((r) => r.applicationId));
    for (const a of needFollow) {
      if (has.has(a.id)) continue;
      const opp = await db.query.opportunities.findFirst({ where: eq(schema.opportunities.id, a.opportunityId) });
      await db.insert(schema.reminders).values({
        applicationId: a.id,
        dueAt: new Date(),
        text: `Applied to ${opp?.org ?? "this role"} ${prefs.followUpDays}+ days ago with no response. Send a follow-up?`,
      });
    }
  }
  return { ghosted: stale.length };
}
