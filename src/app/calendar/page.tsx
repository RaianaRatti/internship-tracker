import Link from "next/link";
import { calendarEvents } from "@/lib/calendar";
import { PageHead } from "@/components/ui";
import { type SP } from "@/components/flash";

export default async function Calendar({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const now = new Date();
  const [y, m] = (sp.month ?? `${now.getFullYear()}-${now.getMonth() + 1}`).split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const events = await calendarEvents();
  const byDay = new Map<string, typeof events>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = key(now);
  const prev = new Date(y, m - 2, 1);
  const next = new Date(y, m, 1);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  return (
    <>
      <PageHead icon="calendar" title="Calendar" sub={first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}>
        <Link className="btn" href={`/calendar?month=${prev.getFullYear()}-${prev.getMonth() + 1}`} aria-label="Previous month">←</Link>
        <Link className="btn" href="/calendar">Today</Link>
        <Link className="btn" href={`/calendar?month=${next.getFullYear()}-${next.getMonth() + 1}`} aria-label="Next month">→</Link>
        <a className="btn primary" href="/api/calendar.ics" title="Download, or subscribe to http://localhost:3000/api/calendar.ics in Google Calendar">.ics</a>
      </PageHead>
      <div className="row tight" style={{ marginBottom: 12 }}>
        <span className="tag inv">deadline</span>
        <span className="tag">interview · reminder</span>
      </div>
      <section className="win" style={{ overflow: "hidden" }}>
      <div className="table-wrap">
        <div className="cal" style={{ minWidth: 640 }}>
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => <div key={d} className="dow">{d}</div>)}
          {days.map((d) => {
            const k = key(d);
            const evs = byDay.get(k) ?? [];
            return (
              <div key={k} className={`${d.getMonth() !== m - 1 ? "out" : ""} ${k === today ? "today" : ""}`}>
                <span className="num">{d.getDate()}</span>
                {evs.map((e, i) => (
                  <Link key={i} href={e.href} className={`ev ${e.kind === "deadline" || e.kind === "decision" ? "deadline" : ""}`} title={e.title}>
                    {e.at ? `${e.at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} ` : ""}{e.title}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      </section>
    </>
  );
}
