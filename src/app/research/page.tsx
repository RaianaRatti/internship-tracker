import Link from "next/link";
import { Win, Empty, TYPE_LABEL, PageHead, Hint } from "@/components/ui";
import { Px } from "@/components/px";
import { Flash, type SP } from "@/components/flash";
import { Submit } from "@/components/submit";
import { loadCurated, eligibilityIssues } from "@/lib/research/curated";
import { searchInstitutions, findResearchers, type Researcher, type Institution } from "@/lib/research/openalex";
import { getProfile } from "@/lib/settings";
import { trackCurated, trackResearcher } from "../actions/research";

export default async function Research({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab = sp.tab ?? "faculty";
  return (
    <>
      <PageHead icon="flask" title="Research" sub="Labs, summer programs, fellowships & scholarships" />
      <Flash sp={sp} />
      <nav className="tabs">
        {([["faculty", "Find a lab", "search"], ["research", "Summer research", "flask"], ["fellowships", "Fellowships", "star"], ["scholarships", "Scholarships", "book"]] as const).map(([k, l, icon]) => (
          <Link key={k} href={`/research?tab=${k}`} aria-current={tab === k ? "page" : undefined}><Px name={icon} /> {l}</Link>
        ))}
      </nav>
      {tab === "faculty" ? <Faculty sp={sp} /> : <Curated list={tab as "research" | "fellowships" | "scholarships"} />}
    </>
  );
}

async function Faculty({ sp }: { sp: Record<string, string | undefined> }) {
  let institutions: Institution[] = [];
  let researchers: Researcher[] = [];
  let error: string | null = null;
  const inst = sp.inst;
  try {
    if (sp.school && !inst) institutions = await searchInstitutions(sp.school);
    if (inst && sp.topic) researchers = await findResearchers(sp.topic, inst);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return (
    <>
      <Win title="Find a lab" icon="search" right={<Hint>Searches recent papers on OpenAlex (a free research catalog). The last author on a paper is usually the lab head.</Hint>}>
        <form method="get" className="form">
          <input type="hidden" name="tab" value="faculty" />
          <label>School <input name="school" defaultValue={sp.school} placeholder="Carnegie Mellon" required /></label>
          <label>Topic <input name="topic" defaultValue={sp.topic} placeholder="robot learning" required /></label>
          {inst && <input type="hidden" name="inst" value={inst} />}
          <div className="row"><Submit className="primary" pendingText="SEARCHING">SEARCH</Submit>{inst && <Link className="btn" href={`/research?tab=faculty&school=${encodeURIComponent(sp.school ?? "")}&topic=${encodeURIComponent(sp.topic ?? "")}`}>CHANGE SCHOOL</Link>}</div>
        </form>
      </Win>
      {error && <div className="alert inv">✗ {error}</div>}
      {institutions.length > 0 && (
        <Win title="Which school?" icon="flag">
          <div className="row">
            {institutions.map((i) => (
              <Link key={i.id} className="btn" href={`/research?tab=faculty&school=${encodeURIComponent(i.name)}&topic=${encodeURIComponent(sp.topic ?? "")}&inst=${i.id}`}>
                {i.name} {i.country && <small>({i.country})</small>}
              </Link>
            ))}
          </div>
        </Win>
      )}
      {inst && sp.topic && (
        <Win title={`Researchers · ${sp.topic}`} icon="user">
          {researchers.length ? (
            researchers.map((r) => (
              <div key={r.openAlexId} className="item">
                <div className="row between">
                  <div>
                    <b>{r.name}</b> {r.lastAuthorCount > 0 && <span className="tag inv">likely PI</span>}
                  </div>
                  <form action={trackResearcher}>
                    <input type="hidden" name="name" value={r.name} />
                    <input type="hidden" name="institution" value={sp.school ?? ""} />
                    <input type="hidden" name="topic" value={sp.topic} />
                    <input type="hidden" name="openAlexId" value={r.openAlexId} />
                    <input type="hidden" name="papers" value={r.papers.map((p) => `- ${p.title} (${p.year})`).join("\n")} />
                    <Submit className="small">TRACK + DRAFT EMAIL →</Submit>
                  </form>
                </div>
                <ul style={{ margin: "4px 0 0" }}>
                  {r.papers.map((p, i) => (
                    <li key={i}><a href={p.url ?? "#"} target="_blank" rel="noreferrer">{p.title}</a> <small>({p.year}, {p.citations} citations)</small></li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <Empty>No recent papers found. Try a broader topic.</Empty>
          )}
        </Win>
      )}
    </>
  );
}

async function Curated({ list }: { list: "research" | "fellowships" | "scholarships" }) {
  const profile = await getProfile();
  const items = loadCurated().filter((p) => p.list === list);
  return (
    <Win title={list} icon="star" flush right={<Hint>Curated list (add more in data/*.yaml). Deadlines are typical; confirm on each site. Eligibility uses your class year and work authorization.</Hint>}>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Program</th><th>Usually due</th><th>Eligibility</th><th></th></tr></thead>
          <tbody>
            {items.map((p) => {
              const issues = eligibilityIssues(p, profile);
              return (
                <tr key={p.name} data-nav>
                  <td>
                    <a href={p.url} target="_blank" rel="noreferrer">{p.name}</a>
                    <div className="meta">{p.org} · {p.summary}{p.type !== "research" && list === "scholarships" ? ` · ${TYPE_LABEL[p.type]}` : ""}</div>
                  </td>
                  <td className="meta" style={{ width: 170 }}>{p.typical_deadline ?? "—"}</td>
                  <td className="meta" style={{ width: 150 }}>{issues.length ? `⚠ ${issues.join("; ")}` : <span className="tag">eligible</span>}</td>
                  <td className="actions">
                    <form action={trackCurated}>
                      <input type="hidden" name="name" value={p.name} />
                      <button className="small">+ Track</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Win>
  );
}
