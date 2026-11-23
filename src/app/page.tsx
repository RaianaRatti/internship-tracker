import Link from "next/link";
import { and, asc, desc, eq, gte, isNotNull, isNull, lte, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { Win, StatusBadge, Fit, Empty, fmtDate, Meter, PageHead, Stat } from "@/components/ui";
import { Px } from "@/components/px";
import { Flash, type SP } from "@/components/flash";
import { Sprite } from "@/components/sprite";
import { getProfile } from "@/lib/settings";
import { STATUS_LABEL, RESPONDED } from "@/lib/core/status";
import { completeReminder, trackAction } from "./actions/tracker";
import { ensureSeeded } from "@/lib/sources/run";
import type { Status } from "@/db/schema";

export default async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await ensureSeeded();
  const profile = await getProfile();
  const today = new Date().toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);

  const [apps, counts, deadlines, fresh, reminders, review, lastEvent, vaultCount] = await Promise.all([
    db.select().from(schema.applications),
    db.select({ status: schema.applications.status, n: sql<number>`count(*)` }).from(schema.applications).groupBy(schema.applications.status),
    db
      .select({ app: schema.applications, opp: schema.opportunities })
      .from(schema.opportunities)
      .leftJoin(schema.applications, eq(schema.applications.opportunityId, schema.opportunities.id))
      .where(and(isNotNull(schema.opportunities.deadline), gte(schema.opportunities.deadline, today), lte(schema.opportunities.deadline, in14), isNotNull(schema.applications.id)))
      .orderBy(asc(schema.opportunities.deadline))
      .limit(8),
    db
      .select()
      .from(schema.opportunities)
      .leftJoin(schema.applications, eq(schema.applications.opportunityId, schema.opportunities.id))
      .where(and(isNull(schema.opportunities.closedAt), eq(schema.opportunities.hidden, false), isNull(schema.applications.id), gte(schema.opportunities.firstSeenAt, new Date(Date.now() - 3 * 86400_000))))
      .orderBy(desc(schema.opportunities.fitScore))
      .limit(6),
    db.select().from(schema.reminders).where(and(eq(schema.reminders.done, false), lte(schema.reminders.dueAt, new Date(Date.now() + 86400_000)))).orderBy(asc(schema.reminders.dueAt)).limit(8),
    db.select({ n: sql<number>`count(*)` }).from(schema.emails).where(eq(schema.emails.reviewState, "pending")),
    db.select().from(schema.applicationEvents).where(and(eq(schema.applicationEvents.kind, "status_change"), ne(schema.applicationEvents.origin, "system"))).orderBy(desc(schema.applicationEvents.occurredAt)).limit(1),
    Promise.all([schema.education, schema.experiences, schema.projects, schema.skills].map((t) => db.select({ n: sql<number>`count(*)` }).from(t))),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])) as Partial<Record<Status, number>>;
  const isApplied = (a: (typeof apps)[number]) => !!a.appliedAt || !["saved", "preparing", "withdrawn"].includes(a.status);
  const applied = apps.filter(isApplied).length;
  const responded = apps.filter((a) => isApplied(a) && RESPONDED.includes(a.status)).length;
  const mood = /Offer|Accepted/.test(lastEvent[0]?.title ?? "") ? "happy" : /Rejected/.test(lastEvent[0]?.title ?? "") ? "sad" : "idle";

  // Onboarding checklist ("create your character", PLAN.md §12 Phase 7).
  const [edu, exp, proj, sk] = vaultCount.map((r) => Number(r[0].n));
  const steps = [
    { done: !!profile.name, label: "Name your character", href: "/vault" },
    { done: edu + exp + proj > 0, label: "Add education, experience or projects (or import a resume)", href: "/vault?tab=import" },
    { done: sk > 0, label: "List your skills", href: "/vault?tab=skills" },
    { done: (profile.preferences?.roles?.length ?? 0) > 0 && !!profile.preferences, label: "Set what you're looking for", href: "/settings" },
    { done: apps.length > 0, label: "Track your first quest", href: "/quests" },
  ];
  const remaining = steps.filter((s) => !s.done);

  return (
    <>
      <PageHead
        icon="home"
        title={profile.name ? `Hi, ${profile.name.split(" ")[0]}` : "Welcome"}
        sub={reminders.length ? `${reminders.length} thing${reminders.length > 1 ? "s" : ""} to do today` : "Nothing urgent today"}
      >
        <Link className="btn primary" href="/add">+ Add quest</Link>
      </PageHead>
      <Flash sp={sp} />
      {Number(review[0].n) > 0 && (
        <div className="alert inv">
          <Px name="mail" /> {review[0].n} email(s) to review <Link className="link right" href="/messenger">Open →</Link>
        </div>
      )}

      <div className="grid-4" style={{ marginBottom: 26 }}>
        <Stat icon="list" value={apps.length} label="tracked" />
        <Stat icon="flag" value={applied} label="applied" />
        <Stat icon="star" value={byStatus.interviewing ?? 0} label="interviewing" />
        <Stat icon="check" value={(byStatus.offer ?? 0) + (byStatus.accepted ?? 0)} label="offers" />
      </div>

      {remaining.length > 0 && (
        <Win title="Get started" icon="list" right={<Meter value={(steps.length - remaining.length) / steps.length} max={steps.length} />}>
          <ul className="checklist">
            {steps.map((s) => (
              <li key={s.label} className={s.done ? "done" : ""}>
                <i className="box" />
                {s.done ? <span>{s.label}</span> : <Link className="link" href={s.href}>{s.label}</Link>}
              </li>
            ))}
          </ul>
        </Win>
      )}

      <div className="grid-2" style={{ marginBottom: 22 }}>
        <Win title="Due soon" icon="clock" right={<Link className="link" href="/calendar">calendar</Link>}>
          {deadlines.length ? (
            <table>
              <tbody>
                {deadlines.map(({ app, opp }) => (
                  <tr key={opp.id} data-nav>
                    <td className="nowrap" style={{ width: 70 }}><span className="tag">{fmtDate(opp.deadline)}</span></td>
                    <td><Link href={`/log/${app!.id}`}>{opp.title}</Link><div className="meta">{opp.org}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>No deadlines in the next 2 weeks</Empty>
          )}
        </Win>

        <Win title="To do" icon="check">
          {reminders.length ? (
            <ul className="stack" style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {reminders.map((r) => (
                <li key={r.id} className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                  <form action={completeReminder.bind(null, r.id)}>
                    <button className="small" title="Mark done" aria-label="Mark done">✓</button>
                  </form>
                  <span className="grow">{r.applicationId ? <Link href={`/log/${r.applicationId}`}>{r.text}</Link> : r.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>All caught up</Empty>
          )}
        </Win>
      </div>

      <Win title="New matches" icon="search" flush right={<Link className="link" href="/quests">see all</Link>}>
        {fresh.length ? (
          <table>
            <tbody>
              {fresh.map(({ opportunities: o }) => (
                <tr key={o.id} data-nav>
                  <td style={{ width: 54 }}><Fit score={o.fitScore} /></td>
                  <td>
                    <a href={o.url ?? "#"} target="_blank" rel="noreferrer">{o.title}</a>
                    <div className="meta">{o.org} · {o.location ?? "—"}</div>
                  </td>
                  <td className="actions">
                    <form action={async () => { "use server"; await trackAction(o.id); }}>
                      <button className="small">+ Track</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="win-body"><Empty href="/quests" cta="Sync sources">Nothing new in 3 days</Empty></div>
        )}
      </Win>

      {apps.length > 0 && (
        <Win title="Pipeline" icon="chart">
          <div className="row tight">
            {(Object.keys(STATUS_LABEL) as Status[]).filter((s) => byStatus[s]).map((s) => (
              <Link key={s} href={`/log?view=table&status=${s}`} className="row tight" style={{ marginRight: 10 }}>
                <StatusBadge status={s} /> <b>{byStatus[s]}</b>
              </Link>
            ))}
          </div>
        </Win>
      )}
    </>
  );
}
