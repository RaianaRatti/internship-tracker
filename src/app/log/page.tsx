import Link from "next/link";
import { and, desc, eq, like, or, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { STATUSES, OPPORTUNITY_TYPES } from "@/db/schema";
import { Win, StatusBadge, Empty, fmtDate, TYPE_LABEL, PageHead } from "@/components/ui";
import { Kanban, type Card } from "@/components/kanban";
import { Flash, type SP } from "@/components/flash";
import { BOARD_COLUMNS, STATUS_LABEL } from "@/lib/core/status";

export default async function QuestLog({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const view = sp.view === "table" ? "table" : sp.view === "offers" ? "offers" : "board";
  const where: SQL[] = [];
  if (sp.status) where.push(eq(schema.applications.status, sp.status as never));
  if (sp.type) where.push(eq(schema.opportunities.type, sp.type as never));
  if (sp.q) where.push(or(like(schema.opportunities.title, `%${sp.q}%`), like(schema.opportunities.org, `%${sp.q}%`))!);

  const rows = await db
    .select({ a: schema.applications, o: schema.opportunities })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(schema.applications.statusChangedAt));

  const tabs = [
    ["board", "Board"],
    ["table", "Table"],
    ["offers", "Offers"],
  ];

  return (
    <>
      <PageHead icon="list" title="Quest Log" sub={`${rows.length} quest${rows.length === 1 ? "" : "s"}`}>
        <Link className="btn primary" href="/add">+ Add</Link>
      </PageHead>
      <Flash sp={sp} />
      <nav className="tabs">
        {tabs.map(([v, l]) => (
          <Link key={v} href={`/log?view=${v}`} aria-current={view === v ? "page" : undefined}>{l}</Link>
        ))}
      </nav>
      {!rows.length && !sp.q && !sp.status ? (
        <Win title="Nothing yet" icon="list"><Empty href="/quests" cta="Browse the Quest Board">No quests tracked yet</Empty></Win>
      ) : view === "board" ? (
        <Kanban
          columns={BOARD_COLUMNS}
          cards={rows.map(({ a, o }): Card => ({
            id: a.id,
            org: o.org,
            title: o.title,
            status: a.status,
            deadline: o.deadline ? fmtDate(o.deadline) : null,
            type: o.type,
            days: Math.floor((Date.now() - a.statusChangedAt.getTime()) / 86400_000),
          }))}
        />
      ) : view === "offers" ? (
        <Offers />
      ) : (
        <>
          <form method="get" className="win win-body row tight" style={{ marginBottom: 22 }}>
            <input type="hidden" name="view" value="table" />
            <input id="search" name="q" defaultValue={sp.q} placeholder="Search" className="grow" style={{ minWidth: 180 }} />
            <select name="status" defaultValue={sp.status ?? ""} style={{ maxWidth: 180 }}>
              <option value="">Any status</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <select name="type" defaultValue={sp.type ?? ""} style={{ maxWidth: 180 }}>
              <option value="">Any type</option>
              {OPPORTUNITY_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <button className="primary">Go</button>
          </form>
          <Win title="All quests" icon="list" flush>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Status</th><th>Role</th><th className="hide-sm">Type</th><th>Applied</th><th>Due</th></tr></thead>
                <tbody>
                  {rows.map(({ a, o }) => (
                    <tr key={a.id} data-nav>
                      <td><StatusBadge status={a.status} /></td>
                      <td><Link href={`/log/${a.id}`}>{o.title}</Link><div><small>{o.org}</small></div></td>
                      <td className="meta hide-sm">{TYPE_LABEL[o.type]}</td>
                      <td className="nowrap meta">{fmtDate(a.appliedAt)}</td>
                      <td className="nowrap meta">{fmtDate(o.deadline)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Win>
        </>
      )}
    </>
  );
}

async function Offers() {
  const offers = await db
    .select({ f: schema.offers, a: schema.applications, o: schema.opportunities })
    .from(schema.offers)
    .innerJoin(schema.applications, eq(schema.offers.applicationId, schema.applications.id))
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id));
  if (!offers.length) return <Win title="Offers" icon="check"><Empty>No offers yet. They'll show up here side by side</Empty></Win>;
  const rows: [string, (x: (typeof offers)[number]) => React.ReactNode][] = [
    ["Status", (x) => <StatusBadge status={x.a.status} />],
    ["Hourly", (x) => (x.f.hourly ? `$${x.f.hourly}/hr` : "—")],
    ["Est. 12-week pay", (x) => (x.f.hourly ? `$${Math.round(x.f.hourly * 40 * 12).toLocaleString()}` : "—")],
    ["Monthly stipend", (x) => (x.f.monthlyStipend ? `$${x.f.monthlyStipend}` : "—")],
    ["Housing", (x) => x.f.housing ?? "—"],
    ["Relocation", (x) => x.f.relocation ?? "—"],
    ["Location", (x) => x.o.location ?? "—"],
    ["Other", (x) => x.f.other ?? "—"],
    ["Decide by", (x) => fmtDate(x.f.decisionDeadline)],
    ["Notes", (x) => <span className="pre">{x.f.notes ?? ""}</span>],
  ];
  return (
    <Win title="Compare offers" icon="check" flush>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th></th>{offers.map((x) => <th key={x.f.id}><Link href={`/log/${x.a.id}`}>{x.o.org}</Link></th>)}</tr>
          </thead>
          <tbody>
            {rows.map(([label, get]) => (
              <tr key={label}><td><b>{label}</b></td>{offers.map((x) => <td key={x.f.id}>{get(x)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </Win>
  );
}
