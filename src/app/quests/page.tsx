import Link from "next/link";
import { and, asc, desc, eq, gte, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { OPPORTUNITY_TYPES } from "@/db/schema";
import { Fit, Empty, daysAgo, fmtDate, TYPE_LABEL, StatusBadge, PageHead, Win } from "@/components/ui";
import { Flash, type SP } from "@/components/flash";
import { Submit } from "@/components/submit";
import { syncNow, rerankTop } from "../actions/discovery";
import { trackAction, hideOpportunity } from "../actions/tracker";
import { aiConfigured } from "@/lib/ai/client";
import { ensureSeeded } from "@/lib/sources/run";

const PAGE = 50;

export default async function QuestBoard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await ensureSeeded();
  const q = sp.q?.trim();
  const page = Math.max(1, Number(sp.page ?? 1));
  const sort = sp.sort ?? "fit";

  const where: SQL[] = [isNull(schema.opportunities.closedAt), eq(schema.opportunities.hidden, false)];
  if (q) {
    const pat = `%${q}%`;
    where.push(or(like(schema.opportunities.title, pat), like(schema.opportunities.org, pat), like(schema.opportunities.location, pat))!);
  }
  if (sp.type) where.push(eq(schema.opportunities.type, sp.type as never));
  if (sp.season) where.push(eq(schema.opportunities.season, sp.season));
  if (sp.source) where.push(eq(schema.opportunities.sourceId, sp.source));
  if (sp.remote) where.push(eq(schema.opportunities.remote, true));
  if (sp.minFit) where.push(gte(schema.opportunities.fitScore, Number(sp.minFit)));
  if (!sp.tracked) where.push(isNull(schema.applications.id));

  const order =
    sort === "new" ? [desc(schema.opportunities.firstSeenAt), desc(schema.opportunities.postedAt)] :
    sort === "deadline" ? [sql`${schema.opportunities.deadline} is null`, asc(schema.opportunities.deadline)] :
    [desc(schema.opportunities.fitScore), desc(schema.opportunities.postedAt)];

  const base = db
    .select({ o: schema.opportunities, appId: schema.applications.id, status: schema.applications.status })
    .from(schema.opportunities)
    .leftJoin(schema.applications, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(and(...where));
  const [rows, total, seasons, sources] = await Promise.all([
    base.orderBy(...order).limit(PAGE).offset((page - 1) * PAGE),
    db.select({ n: sql<number>`count(*)` }).from(schema.opportunities).leftJoin(schema.applications, eq(schema.applications.opportunityId, schema.opportunities.id)).where(and(...where)),
    db.selectDistinct({ s: schema.opportunities.season }).from(schema.opportunities).where(isNull(schema.opportunities.closedAt)).orderBy(desc(schema.opportunities.season)),
    db.select().from(schema.sources).orderBy(asc(schema.sources.id)),
  ]);
  const count = Number(total[0].n);
  const recent = Date.now() - 86400_000;
  const link = (patch: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { ...sp, msg: undefined, err: undefined, ...patch };
    const p = new URLSearchParams(Object.entries(merged).filter((e): e is [string, string] => !!e[1]));
    return `/quests?${p}`;
  };

  return (
    <>
      <PageHead icon="search" title="Quest Board" sub={`${count.toLocaleString()} open · ${sort === "fit" ? "best fit first" : sort === "new" ? "newest first" : "by deadline"}`}>
        {aiConfigured() && (
          <form action={rerankTop}>
            <Submit pendingText="Thinking">✦ AI rank</Submit>
          </form>
        )}
        <form action={syncNow}>
          <input type="hidden" name="from" value="/quests" />
          <Submit className="primary" pendingText="Syncing">↻ Sync</Submit>
        </form>
      </PageHead>
      <Flash sp={sp} />

      <form method="get" action="/quests" className="win stack win-body" style={{ marginBottom: 22 }}>
        <div className="row tight">
          <input id="search" name="q" defaultValue={q} placeholder="Search roles, companies, places" className="grow" style={{ minWidth: 200 }} />
          <select name="type" defaultValue={sp.type ?? ""} style={{ width: 150 }} aria-label="Type">
            <option value="">All types</option>
            {OPPORTUNITY_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <select name="season" defaultValue={sp.season ?? ""} style={{ width: 150 }} aria-label="Season">
            <option value="">Any season</option>
            {seasons.filter((s) => s.s).map((s) => <option key={s.s} value={s.s!}>{s.s}</option>)}
          </select>
          <select name="sort" defaultValue={sort} style={{ width: 130 }} aria-label="Sort">
            <option value="fit">Best fit</option>
            <option value="new">Newest</option>
            <option value="deadline">Deadline</option>
          </select>
          <button className="primary">Go</button>
        </div>
        <details>
          <summary className="label">More filters</summary>
          <div className="row" style={{ marginTop: 10 }}>
            <select name="source" defaultValue={sp.source ?? ""} style={{ width: 180 }} aria-label="Source">
              <option value="">Any source</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
            </select>
            <input name="minFit" type="number" min={0} max={100} defaultValue={sp.minFit} placeholder="Min fit" style={{ width: 110 }} />
            <label className="inline"><input type="checkbox" name="remote" value="1" defaultChecked={!!sp.remote} /> Remote</label>
            <label className="inline"><input type="checkbox" name="tracked" value="1" defaultChecked={!!sp.tracked} /> Include tracked</label>
            {(q || sp.type || sp.season || sp.source || sp.minFit || sp.remote) && <Link className="link" href="/quests">clear</Link>}
          </div>
        </details>
      </form>

      <Win title="Results" icon="list" flush right={<span className="meta">page {page}/{Math.max(1, Math.ceil(count / PAGE))}</span>}>
      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fit</th><th>Opportunity</th><th className="hide-sm">Season</th><th className="hide-sm">Seen</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map(({ o, appId, status }) => (
                <tr key={o.id} data-nav>
                  <td style={{ width: 54 }}><Fit score={o.fitScore} /></td>
                  <td>
                    <a href={o.url ?? "#"} target="_blank" rel="noreferrer">
                      {(o.postedAt ?? o.firstSeenAt).getTime() > recent && <span className="new">new</span>}
                      {o.title}
                    </a>
                    <div className="meta">
                      {o.org} · {o.location ?? "Location n/a"}{o.remote ? " · remote" : ""}
                      {o.type !== "internship" && ` · ${TYPE_LABEL[o.type]}`}
                      {o.deadline && <span className="tag inv">due {fmtDate(o.deadline)}</span>}
                    </div>
                  </td>
                  <td className="nowrap meta hide-sm">{o.season ?? "—"}</td>
                  <td className="nowrap meta hide-sm">{daysAgo(o.postedAt ?? o.firstSeenAt)}</td>
                  <td className="actions">
                    {appId ? (
                      <Link href={`/log/${appId}`}>{status && <StatusBadge status={status} />}</Link>
                    ) : (
                      <div className="row tight" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                        <form action={async () => { "use server"; await hideOpportunity(o.id); }} className="hover-only">
                          <button className="small ghost" title="Hide" aria-label="Hide">✕</button>
                        </form>
                        <form action={async () => { "use server"; await trackAction(o.id); }}>
                          <button className="small">+ Track</button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="win-body"><Empty>No matches. Try fewer filters.</Empty></div>
      )}
      </Win>
      <div className="row between" style={{ marginTop: 18 }}>
        {page > 1 ? <Link className="btn" href={link({ page: String(page - 1) })}>← Prev</Link> : <span />}
        {page * PAGE < count ? <Link className="btn" href={link({ page: String(page + 1) })}>Next →</Link> : <span />}
      </div>
    </>
  );
}
