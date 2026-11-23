import { calendarEvents } from "@/lib/calendar";

// iCalendar feed so deadlines/interviews show up in Google Calendar (PLAN.md §3.9).
export async function GET() {
  const events = await calendarEvents();
  const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Quest Log//EN", "X-WR-CALNAME:Quest Log"];
  events.forEach((e, i) => {
    lines.push("BEGIN:VEVENT", `UID:quest-${e.kind}-${i}-${e.date}@questlog`, `DTSTAMP:${stamp}`);
    if (e.at) {
      const s = e.at.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
      const end = new Date(e.at.getTime() + 3600_000).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
      lines.push(`DTSTART:${s}`, `DTEND:${end}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${e.date.replace(/-/g, "")}`);
    }
    lines.push(`SUMMARY:${esc(e.title)}`, `URL:http://localhost:3000${e.href}`, "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="quest-log.ics"' } });
}
