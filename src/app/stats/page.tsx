import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Win, Empty, TYPE_LABEL, PageHead } from "@/components/ui";
import { RESPONDED } from "@/lib/core/status";
import type { Status } from "@/db/schema";

type Row = { status: Status; appliedAt: Date | null; statusChangedAt: Date; source: string | null; type: string; org: string; resume: string | null; id: number };

const INTERVIEWED: Status[] = ["interviewing", "offer", "accepted", "declined"];
const OFFERED: Status[] = ["offer", "accepted", "declined"];

function rates(rows: Row[]) {
  const applied = rows.filter((r) => r.appliedAt || !["saved", "preparing", "withdrawn"].includes(r.status));
  const n = applied.length;
  const pct = (k: number) => (n ? Math.round((k / n) * 100) : 0);
  return {
    n,
    response: pct(applied.filter((r) => RESPONDED.includes(r.status)).length),
    interview: pct(applied.filter((r) => INTERVIEWED.includes(r.status)).length),
    offer: pct(applied.filter((r) => OFFERED.includes(r.status)).length),
  };
}

function Breakdown({ title, rows, by }: { title: string; rows: Row[]; by: (r: Row) => string }) {
  const groups = new Map<string, Row[]>();
  for (const r of rows) groups.set(by(r), [...(groups.get(by(r)) ?? []), r]);
  const list = [...groups.entries()].map(([k, v]) => ({ k, ...rates(v) })).filter((g) => g.n > 0).sort((a, b) => b.n - a.n);
  return (
    <Win title={title} icon="list" flush>
      {list.length ? (
        <table>
          <thead><tr><th></th><th>Applied</th><th>Reply</th><th>Interview</th><th>Offer</th></tr></thead>
          <tbody>
            {list.map((g) => (
              <tr key={g.k}><td>{g.k}</td><td>{g.n}</td><td>{g.response}%</td><td>{g.interview}%</td><td>{g.offer}%</td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="win-body"><Empty>Apply to a few quests first</Empty></div>
      )}
    </Win>
  );
}

export default async function Stats() {
  const [raw, events, resumes] = await Promise.all([
    db
      .select({ a: schema.applications, o: schema.opportunities })
      .from(schema.applications)
      .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id)),
    db.select().from(schema.applicationEvents),
    db.select().from(schema.documents),
  ]);
  const resumeLabel = new Map(resumes.map((r) => [r.id, r.label]));
  const defaultResume = resumes.find((r) => r.isDefault)?.label ?? "default";
  const rows: Row[] = raw.map(({ a, o }) => ({
    id: a.id,
    status: a.status,
    appliedAt: a.appliedAt,
    statusChangedAt: a.statusChangedAt,
    source: o.sourceId,
    type: TYPE_LABEL[o.type] ?? o.type,
    org: o.org,
    resume: a.resumeDocumentId ? resumeLabel.get(a.resumeDocumentId) ?? "deleted" : defaultResume,
  }));

  const total = rows.length;
  const applied = rows.filter((r) => r.appliedAt || !["saved", "preparing", "withdrawn"].includes(r.status)).length;
  const funnel = [
    ["Tracked", total],
    ["Applied", applied],
    ["Heard back", rows.filter((r) => RESPONDED.includes(r.status)).length],
    ["Interviewed", rows.filter((r) => INTERVIEWED.includes(r.status)).length],
    ["Offer", rows.filter((r) => OFFERED.includes(r.status)).length],
  ] as const;

  // Applications per week, last 12 weeks.
  const weekMs = 7 * 86400_000;
  const now = Date.now();
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const start = now - (12 - i) * weekMs;
    return { label: new Date(start + weekMs).toLocaleDateString("en-US", { month: "numeric", day: "numeric" }), n: rows.filter((r) => r.appliedAt && r.appliedAt.getTime() >= start && r.appliedAt.getTime() < start + weekMs).length };
  });
  const maxWeek = Math.max(1, ...weeks.map((w) => w.n));

  // Time to first response: first non-system event after applying that isn't the applied event itself.
  const firstResponse = new Map<number, number>();
  for (const e of events) {
    const r = rows.find((x) => x.id === e.applicationId);
    if (!r?.appliedAt || e.occurredAt <= r.appliedAt) continue;
    if (!(e.kind === "email" || (e.kind === "status_change" && /Assessment|Interviewing|Rejected|Offer/.test(e.title.split("→")[1] ?? "")))) continue;
    const days = (e.occurredAt.getTime() - r.appliedAt.getTime()) / 86400_000;
    if (!firstResponse.has(r.id) || days < firstResponse.get(r.id)!) firstResponse.set(r.id, days);
  }
  const byCompany = new Map<string, number[]>();
  for (const [id, d] of firstResponse) {
    const org = rows.find((r) => r.id === id)!.org;
    byCompany.set(org, [...(byCompany.get(org) ?? []), d]);
  }
  const avgResp = [...byCompany.entries()].map(([org, ds]) => ({ org, days: ds.reduce((a, b) => a + b, 0) / ds.length })).sort((a, b) => a.days - b.days);

  return (
    <>
      <PageHead icon="chart" title="Stats" sub={`${applied} applied · ${total} tracked`} />
      <div className="grid-2">
        <Win title="Funnel" icon="chart">
          <div className="funnel">
            {funnel.map(([label, n], i) => (
              <div className="lvl" key={label}>
                <span className="lbl">{label}</span>
                <span className="bar" style={{ width: `${total ? Math.max(2, (n / total) * 100) : 2}%` }} />
                <b>{n}</b>
              </div>
            ))}
          </div>
        </Win>
        <Win title="Per week" icon="calendar">
          <div className="bars" role="img" aria-label={`Applications per week: ${weeks.map((w) => `${w.label} ${w.n}`).join(", ")}`}>
            {weeks.map((w, i) => (
              <div key={i} className={`bar${i === weeks.length - 1 ? " alt" : ""}`} style={{ height: `${(w.n / maxWeek) * 100}%`, minHeight: w.n ? 4 : 0 }} title={`${w.label}: ${w.n}`} />
            ))}
          </div>
          <div className="row between"><small>{weeks[0].label}</small><small>max {maxWeek}/wk</small><small>this week</small></div>
        </Win>
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Breakdown title="By source" rows={rows} by={(r) => r.source ?? "manual"} />
        <Breakdown title="By type" rows={rows} by={(r) => r.type} />
      </div>
      <div className="section-gap" />
      <div className="grid-2">
        <Breakdown title="By resume version" rows={rows} by={(r) => r.resume ?? "default"} />
        <Win title="Days to first reply" icon="clock" flush>
          {avgResp.length ? (
            <table>
              <tbody>
                {avgResp.map((c) => <tr key={c.org}><td>{c.org}</td><td>{c.days.toFixed(1)} days</td></tr>)}
              </tbody>
            </table>
          ) : (
            <div className="win-body"><Empty>No replies yet</Empty></div>
          )}
        </Win>
      </div>
    </>
  );
}
