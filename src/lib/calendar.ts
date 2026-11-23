import { and, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";

export type CalEvent = { date: string; at?: Date; title: string; kind: "deadline" | "interview" | "reminder" | "decision"; href: string };

/** Deadlines, interviews, reminders and offer decisions for the tracked quests. */
export async function calendarEvents(): Promise<CalEvent[]> {
  const [deadlines, interviews, reminders, offers] = await Promise.all([
    db
      .select({ appId: schema.applications.id, o: schema.opportunities })
      .from(schema.applications)
      .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
      .where(isNotNull(schema.opportunities.deadline)),
    db
      .select({ iv: schema.interviews, org: schema.opportunities.org })
      .from(schema.interviews)
      .innerJoin(schema.applications, eq(schema.interviews.applicationId, schema.applications.id))
      .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
      .where(isNotNull(schema.interviews.scheduledAt)),
    db.select().from(schema.reminders).where(and(eq(schema.reminders.done, false))),
    db
      .select({ f: schema.offers, org: schema.opportunities.org })
      .from(schema.offers)
      .innerJoin(schema.applications, eq(schema.offers.applicationId, schema.applications.id))
      .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
      .where(isNotNull(schema.offers.decisionDeadline)),
  ]);
  const local = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return [
    ...deadlines.map((d) => ({ date: d.o.deadline!, title: `Due: ${d.o.org} — ${d.o.title}`, kind: "deadline" as const, href: `/log/${d.appId}` })),
    ...interviews.map((i) => ({ date: local(i.iv.scheduledAt!), at: i.iv.scheduledAt!, title: `${i.org}: ${i.iv.round}`, kind: "interview" as const, href: `/log/${i.iv.applicationId}` })),
    ...reminders.map((r) => ({ date: local(r.dueAt), title: r.text, kind: "reminder" as const, href: r.applicationId ? `/log/${r.applicationId}` : "/" })),
    ...offers.map((o) => ({ date: o.f.decisionDeadline!, title: `Decide: ${o.org} offer`, kind: "decision" as const, href: `/log/${o.f.applicationId}` })),
  ];
}
