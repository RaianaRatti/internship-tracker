import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { OPPORTUNITY_TYPES } from "@/db/schema";
import Link from "next/link";
import { Win, fmtDate, TYPE_LABEL, PageHead, Hint } from "@/components/ui";
import { Px, type IconName } from "@/components/px";
import { Flash, type SP } from "@/components/flash";
import { Submit } from "@/components/submit";
import { getPreferences, getExtensionToken } from "@/lib/settings";
import { aiConfigured, GEN_MODEL, FAST_MODEL } from "@/lib/ai/client";
import { gmailConfigured } from "@/lib/gmail/oauth";
import { ensureSeeded } from "@/lib/sources/run";
import { savePreferences, regenerateExtensionToken, deleteEverything } from "../actions/settings";
import { addCompany, updateCompany, deleteCompany, toggleSource, syncNow } from "../actions/discovery";

const SETTINGS_TABS: [string, string, IconName][] = [
  ["goals", "Looking for", "flag"],
  ["companies", "Companies", "home"],
  ["sources", "Sources", "search"],
  ["connect", "Connections", "bolt"],
  ["data", "Your data", "gear"],
];

export default async function Settings({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab = sp.tab ?? "goals";
  await ensureSeeded();
  const [prefs, companies, sources, token] = await Promise.all([
    getPreferences(),
    db.select().from(schema.companies).orderBy(asc(schema.companies.name)),
    db.select().from(schema.sources).orderBy(asc(schema.sources.id)),
    getExtensionToken(),
  ]);

  return (
    <>
      <PageHead icon="gear" title="Settings" sub="What you want, where to look, your data" />
      <Flash sp={sp} />
      <div className="side-layout">
        <nav className="side-tabs" aria-label="Settings sections">
          {SETTINGS_TABS.map(([k, l, icon]) => (
            <Link key={k} href={`/settings?tab=${k}`} aria-current={tab === k ? "page" : undefined}>
              <Px name={icon} /> {l}
            </Link>
          ))}
        </nav>
        <div>
      {tab === "goals" && (
      <Win title="What you're looking for" icon="flag">
        <form action={savePreferences} className="form">
          <label className="full">Roles <input name="roles" defaultValue={prefs.roles.join(", ")} placeholder="software engineer, data science, research" /></label>
          <label className="full">Keywords <input name="keywords" defaultValue={prefs.keywords.join(", ")} placeholder="robotics, compilers, climate" /></label>
          <label>Locations <input name="locations" defaultValue={prefs.locations.join(", ")} placeholder="New York, Seattle" /></label>
          <label>Seasons <input name="seasons" defaultValue={prefs.seasons.join(", ")} placeholder="Summer 2027" /></label>
          <label>Min hourly pay <input type="number" name="minPay" defaultValue={prefs.minPay ?? ""} /></label>
          <label className="inline"><input type="checkbox" name="remoteOk" defaultChecked={prefs.remoteOk} /> Remote is fine</label>
          <fieldset className="full">
            <legend>Types</legend>
            <div className="row">
              {OPPORTUNITY_TYPES.map((t) => (
                <label key={t} className="inline"><input type="checkbox" name="types" value={t} defaultChecked={prefs.types.includes(t)} /> {TYPE_LABEL[t]}</label>
              ))}
            </div>
          </fieldset>
          <label>Ghosted after (days) <input type="number" name="ghostDays" defaultValue={prefs.ghostDays} min={7} /></label>
          <label>Follow up after (days) <input type="number" name="followUpDays" defaultValue={prefs.followUpDays} min={3} /></label>
          <div className="full"><Submit className="primary">Save</Submit></div>
        </form>
      </Win>
      )}

      {tab === "companies" && (
      <Win title={`Companies · ${companies.length}`} icon="home" right={<Hint>Dream/target/safety tiers boost fit scores. Watched companies remind you when they open student roles. The job board is detected automatically.</Hint>}>
        <form action={addCompany} className="form" style={{ marginBottom: 14 }}>
          <label>Company <input name="name" required placeholder="Figma" /></label>
          <label>Careers URL (optional) <input name="careersUrl" type="url" placeholder="https://boards.greenhouse.io/figma" /></label>
          <label>Tier
            <select name="tier" defaultValue="">
              <option value="">—</option><option value="dream">Dream</option><option value="target">Target</option><option value="safety">Safety</option>
            </select>
          </label>
          <label className="inline"><input type="checkbox" name="watch" /> Watch for openings</label>
          <div className="full"><Submit className="primary" pendingText="Detecting">+ Add</Submit></div>
        </form>
        <div className="table-wrap" style={{ maxHeight: 460, overflowY: "auto" }}>
          <table>
            <thead><tr><th>Company</th><th className="hide-sm">Board</th><th>Tier</th><th className="hide-sm">Open</th><th></th></tr></thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="meta hide-sm">{c.ats}</td>
                  <td>
                    <form action={updateCompany.bind(null, c.id)} className="row tight" style={{ flexWrap: "nowrap" }}>
                      <select name="tier" defaultValue={c.tier ?? ""} style={{ width: 110 }}>
                        <option value="">—</option><option value="dream">Dream</option><option value="target">Target</option><option value="safety">Safety</option>
                      </select>
                      <label className="inline"><input type="checkbox" name="watch" defaultChecked={!!c.watch} /> watch</label>
                      <button className="small">Set</button>
                    </form>
                  </td>
                  <td className="meta hide-sm">{c.lastCheckedAt ? c.lastOpenCount ?? 0 : "—"}</td>
                  <td><form action={deleteCompany.bind(null, c.id)}><button className="small ghost">✕</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Win>
      )}

      {tab === "sources" && (
      <Win title="Sources" icon="search" flush right={<><Hint>Run `npm run worker` to sync every 6 hours in the background.</Hint><form action={syncNow}><input type="hidden" name="from" value="/settings?tab=sources" /><Submit className="small primary" pendingText="…">↻ Sync all</Submit></form></>}>
        <table>
          <thead><tr><th>Source</th><th>Last run</th><th className="hide-sm">Result</th><th></th></tr></thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td className="meta">{s.lastRunAt ? fmtDate(s.lastRunAt) : "—"}</td>
                <td className="meta hide-sm">{s.lastStatus ?? "—"}</td>
                <td className="actions">
                  <form action={toggleSource.bind(null, s.id, !s.enabled)}>
                    <button className={`small${s.enabled ? " primary" : ""}`}>{s.enabled ? "On" : "Off"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Win>
      )}

      {tab === "connect" && (
        <>
          <Win title="Integrations" icon="bolt">
            <dl className="kv">
              <dt>Claude API</dt>
              <dd>{aiConfigured() ? <span className="tag">on · {GEN_MODEL}</span> : <span className="meta">off · set ANTHROPIC_API_KEY</span>}</dd>
              <dt>Gmail</dt>
              <dd>{gmailConfigured() ? <Link className="link" href="/messenger">ready → Messenger</Link> : <span className="meta">off · see Messenger</span>}</dd>
              <dt>Calendar</dt>
              <dd><a className="link" href="/api/calendar.ics">.ics feed</a></dd>
            </dl>
          </Win>
          <Win title="Browser extension" icon="link" right={<Hint>chrome://extensions → Developer mode → Load unpacked → pick the extension/ folder, then paste this token in its options.</Hint>}>
            <div className="row tight">
              <code style={{ userSelect: "all" }}>{token}</code>
              <form action={regenerateExtensionToken}><button className="small ghost">New token</button></form>
            </div>
          </Win>
        </>
      )}

      {tab === "data" && (
      <Win title="Your data" icon="gear">
        <a className="btn" href="/api/export">⤓ Export everything</a>
        <hr />
        <form action={deleteEverything} className="row tight">
          <input name="confirm" placeholder='Type "DELETE"' style={{ maxWidth: 220 }} />
          <button>Erase all data</button>
        </form>
      </Win>
      )}
        </div>
      </div>
    </>
  );
}
