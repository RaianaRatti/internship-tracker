import Link from "next/link";
import { and, desc, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { Win, Empty, fmtDate, PageHead, Hint } from "@/components/ui";
import { Px, type IconName } from "@/components/px";
import { Flash, type SP } from "@/components/flash";
import { Submit } from "@/components/submit";
import { DOC_KINDS, type DocKind } from "@/lib/ai/forge";
import { aiConfigured } from "@/lib/ai/client";
import { wordCount } from "@/lib/core/text";
import { forgeAction, refineAction, saveDocEdits, saveDocToLibrary, attachDoc, deleteDoc } from "../actions/forge";
import { createLetterAction, rewordAction, saveResumeVersion } from "../actions/rules";
import { StoryForm } from "@/components/story-form";
import { ResumeView } from "@/components/resume-view";
import { resumeFromParams } from "@/lib/rules/resume-request";
import type { Check } from "@/lib/rules/cover-letter";

const TABS: [string, string, IconName][] = [
  ["letter", "Cover letter", "quill"],
  ["resume", "Resume", "doc"],
  ["ai", "AI writer", "bolt"],
];

export default async function Forge({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  if (sp.doc) {
    return (
      <>
        <Flash sp={sp} />
        <DocView id={Number(sp.doc)} />
      </>
    );
  }
  const kind = sp.kind as DocKind | undefined;
  const tab = sp.tab ?? (kind && kind !== "cover_letter" ? "ai" : "letter");
  const appId = sp.app ? Number(sp.app) : null;
  const keep = (t: string) => `/forge?tab=${t}${appId ? `&app=${appId}` : ""}`;
  return (
    <>
      <PageHead icon="quill" title="Forge" sub="Cover letters & resumes, no AI needed" />
      <Flash sp={sp} />
      <nav className="tabs">
        {TABS.map(([k, l, icon]) => (
          <Link key={k} href={keep(k)} aria-current={tab === k ? "page" : undefined}><Px name={icon} /> {l}</Link>
        ))}
      </nav>
      {tab === "letter" && <LetterTab appId={appId} />}
      {tab === "resume" && <ResumeTab sp={sp} />}
      {tab === "ai" && (
        <>
          {!aiConfigured() && <div className="alert"><Px name="bolt" /> Needs a Claude key: add ANTHROPIC_API_KEY to .env.local</div>}
          <NewDoc appId={appId} kind={kind && kind !== "cover_letter" ? kind : "essay"} />
        </>
      )}
    </>
  );
}

async function trackedApps() {
  return db
    .select({ id: schema.applications.id, org: schema.opportunities.org, title: schema.opportunities.title })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
    .where(ne(schema.applications.status, "rejected"))
    .orderBy(desc(schema.applications.statusChangedAt));
}

async function LetterTab({ appId }: { appId: number | null }) {
  const [apps, stories, recent] = await Promise.all([
    trackedApps(),
    db.select().from(schema.stories).orderBy(desc(schema.stories.createdAt)),
    db.select().from(schema.generatedDocs).where(eq(schema.generatedDocs.kind, "cover_letter")).orderBy(desc(schema.generatedDocs.createdAt)).limit(12),
  ]);
  if (!stories.length) {
    return (
      <Win title="First, write a story" icon="book" right={<Hint>Letters open with a real moment, connect it to the role, then call back to it. Write it once; every letter reuses it.</Hint>}>
        <StoryForm from={`/forge?tab=letter${appId ? `&app=${appId}` : ""}`} />
      </Win>
    );
  }
  return (
    <div className="grid-2">
      <Win title="New cover letter" icon="doc" right={<Hint>Story → why this role → how you fit → back to the story. Built by rules from your stories and Character Sheet.</Hint>}>
        <form action={createLetterAction} className="form">
          <label className="full">For quest
            <select name="applicationId" defaultValue={appId ?? ""}>
              <option value="">— paste a posting instead —</option>
              {apps.map((a) => <option key={a.id} value={a.id}>{a.org}: {a.title}</option>)}
            </select>
          </label>
          <details className="full">
            <summary className="label">Not tracked? Paste the posting</summary>
            <div className="form" style={{ marginTop: 10 }}>
              <label>Company <input name="company" /></label>
              <label>Role <input name="role" /></label>
              <label className="full">Posting text <textarea name="jobText" rows={5} /></label>
            </div>
          </details>
          <label>Story
            <select name="storyId" defaultValue="">
              <option value="">Best match for this posting</option>
              {stories.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </label>
          <label>Tone
            <select name="tone" defaultValue="warm">
              <option value="warm">Warm</option>
              <option value="formal">Formal</option>
            </select>
          </label>
          <label className="full">Why this company? (one sentence, optional)
            <input name="whyCompany" placeholder="I've used Figma for every club project since high school, and I want to help build the tool that taught me design." />
          </label>
          <div className="full"><Submit className="primary" pendingText="Writing">Write letter</Submit></div>
        </form>
      </Win>
      <div>
        <Win title="Stories" icon="book" right={<Link className="link" href="/spellbook?tab=stories">edit</Link>}>
          {stories.map((s) => (
            <div key={s.id} className="item">
              {s.title}
              <div><span className="tag">{s.theme}</span></div>
            </div>
          ))}
        </Win>
        <Win title="Recent" icon="clock" flush>
          {recent.length ? (
            <table>
              <tbody>
                {recent.map((d) => (
                  <tr key={d.id} data-nav>
                    <td><Link href={`/forge?doc=${d.id}`}>{d.title.replace(/^Cover letter: /, "")}</Link><div className="meta">v{d.version} · {fmtDate(d.createdAt)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="win-body"><Empty>No letters yet</Empty></div>
          )}
        </Win>
      </div>
    </div>
  );
}

async function ResumeTab({ sp }: { sp: Record<string, string | undefined> }) {
  const [apps, { doc }] = await Promise.all([trackedApps(), resumeFromParams(sp)]);
  const params = new URLSearchParams(Object.entries({ app: sp.app, bullets: sp.bullets, projects: sp.projects, activities: sp.activities }).filter((e): e is [string, string] => !!e[1]));
  return (
    <div className="split">
      <Win title="Preview" icon="doc" flush>
        <div className="table-wrap">
          <div className="resume-sheet"><ResumeView doc={doc} /></div>
        </div>
      </Win>
      <div>
        <Win title="Tailor" icon="gear">
          <form method="get" className="stack">
            <input type="hidden" name="tab" value="resume" />
            <select name="app" defaultValue={sp.app ?? ""} aria-label="Tailor for">
              <option value="">General (not tailored)</option>
              {apps.map((a) => <option key={a.id} value={a.id}>{a.org}: {a.title}</option>)}
            </select>
            <div className="row tight">
              <select name="bullets" defaultValue={sp.bullets ?? "4"} className="grow" aria-label="Bullets per role">
                {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} bullets</option>)}
              </select>
              <select name="projects" defaultValue={sp.projects ?? "3"} className="grow" aria-label="Projects">
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} project{n > 1 ? "s" : ""}</option>)}
              </select>
            </div>
            <label className="inline"><input type="checkbox" name="activities" value="0" defaultChecked={sp.activities === "0"} /> Hide activities</label>
            <div><button>Update</button></div>
          </form>
          {doc.notes.length > 0 && (
            <ul className="meta" style={{ margin: "12px 0 0", paddingLeft: 18 }}>
              {doc.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          )}
        </Win>
        <Win title="Export" icon="flag">
          <div className="stack">
            <a className="btn primary block" href={`/api/resume?${params}`}>Download .docx</a>
            <a className="btn block" href={`/print/resume?${params}`} target="_blank">Print / PDF</a>
            <form action={saveResumeVersion}>
              {[...params.entries()].map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              <Submit className="block">{sp.app ? "Save to this quest" : "Save as version"}</Submit>
            </form>
          </div>
          <p className="meta" style={{ margin: "12px 0 0" }}>Edit content in your <Link className="link" href="/vault">Character Sheet</Link></p>
        </Win>
      </div>
    </div>
  );
}

async function NewDoc({ appId, kind }: { appId: number | null; kind: DocKind }) {
  const [apps, recent] = await Promise.all([
    db
      .select({ id: schema.applications.id, org: schema.opportunities.org, title: schema.opportunities.title })
      .from(schema.applications)
      .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id))
      .where(ne(schema.applications.status, "rejected"))
      .orderBy(desc(schema.applications.statusChangedAt)),
    db.select().from(schema.generatedDocs).orderBy(desc(schema.generatedDocs.createdAt)).limit(15),
  ]);
  const pi = appId ? await db.query.contacts.findFirst({ where: and(eq(schema.contacts.applicationId, appId), eq(schema.contacts.role, "pi")) }) : undefined;

  return (
    <div className="grid-2">
      <Win title="Write with AI" icon="bolt" right={<Hint>Uses only facts from your Character Sheet, cites them, and flags anything it can't trace.</Hint>}>
        <form action={forgeAction} className="form">
          <label>Type
            <select name="kind" defaultValue={kind}>
              {(Object.keys(DOC_KINDS) as DocKind[]).filter((k) => k !== "cover_letter").map((k) => <option key={k} value={k}>{DOC_KINDS[k]}</option>)}
            </select>
          </label>
          <label>For quest
            <select name="applicationId" defaultValue={appId ?? ""}>
              <option value="">— none (paste posting below) —</option>
              {apps.map((a) => <option key={a.id} value={a.id}>{a.org}: {a.title}</option>)}
            </select>
          </label>
          <label className="full">Prompt / question (essays, short answers) <textarea name="prompt" rows={2} placeholder="Describe a time you…" /></label>
          <label>Word limit <input type="number" name="wordLimit" min={20} placeholder="e.g. 250" /></label>
          <label>Tone <input name="tone" placeholder="warm, direct" /></label>
          <label className="full">Posting text (if not tracked) <textarea name="jobText" rows={4} /></label>
          <label className="full">For cold emails: professor & papers <textarea name="piContext" rows={3} defaultValue={pi ? `${pi.name} (${pi.companyName})\n${pi.notes ?? ""}` : ""} /></label>
          <label className="full">Anything to include? <textarea name="notes" rows={2} placeholder="I met their recruiter at the career fair; I want to mention my robotics club." /></label>
          <div className="full"><Submit className="primary" pendingText="Writing">Write draft</Submit></div>
        </form>
      </Win>
      <Win title="Recent" icon="clock">
        {recent.length ? (
          <table>
            <tbody>
              {recent.map((d) => (
                <tr key={d.id} data-nav>
                  <td><Link href={`/forge?doc=${d.id}`}>{d.title}</Link><div><small>{DOC_KINDS[d.kind as DocKind]} · v{d.version} · {fmtDate(d.createdAt)}</small></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>Nothing yet</Empty>
        )}
      </Win>
    </div>
  );
}

/** Inverted [ADD: …] placeholders so they're impossible to miss before sending. */
function placeholders(text: string): React.ReactNode {
  const parts = text.split(/(\[ADD:[^\]]*\])/);
  return parts.length === 1 ? text : parts.map((p, i) => (p.startsWith("[ADD:") ? <mark key={i} className="placeholder">{p}</mark> : p));
}

function highlight(text: string, unsupported: string[]): React.ReactNode {
  const hit = unsupported.find((u) => u.length > 8 && text.includes(u));
  if (!hit) return placeholders(text);
  const i = text.indexOf(hit);
  return (
    <>
      {placeholders(text.slice(0, i))}
      <mark className="mark-unsupported" title="Not supported by your Character Sheet">{hit}</mark>
      {highlight(text.slice(i + hit.length), unsupported)}
    </>
  );
}

async function DocView({ id }: { id: number }) {
  const doc = await db.query.generatedDocs.findFirst({ where: eq(schema.generatedDocs.id, id) });
  if (!doc) return <Empty href="/forge" cta="Back to Forge">Document not found</Empty>;
  const [versions, apps] = await Promise.all([
    doc.applicationId
      ? db.select().from(schema.generatedDocs).where(and(eq(schema.generatedDocs.applicationId, doc.applicationId), eq(schema.generatedDocs.kind, doc.kind))).orderBy(desc(schema.generatedDocs.version))
      : Promise.resolve([doc]),
    db
      .select({ id: schema.applications.id, org: schema.opportunities.org, title: schema.opportunities.title })
      .from(schema.applications)
      .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id)),
  ]);
  const unsupported = doc.unsupported ?? [];
  const edited = !!(doc.inputs as { editedByStudent?: boolean } | null)?.editedByStudent;
  const paragraphs = doc.body.split(/\n{2,}/);
  const limit = (doc.inputs as { wordLimit?: number } | null)?.wordLimit;
  const words = wordCount(doc.body);
  const inputs = (doc.inputs ?? {}) as { checks?: Check[]; storyId?: number; storyAuto?: boolean; tone?: string };
  const isRules = doc.model === "rules";
  const stories = isRules ? await db.select().from(schema.stories) : [];
  const ai = aiConfigured();

  return (
    <>
      <PageHead
        icon={doc.kind === "cover_letter" ? "quill" : "doc"}
        title={doc.title.replace(/^Cover letter: /, "")}
        sub={`${DOC_KINDS[doc.kind as DocKind]} · v${doc.version} · ${words} words${limit ? ` / ${limit}` : ""}${isRules ? " · no AI" : ""}`}
        back={{ href: "/forge", label: "Forge" }}
      >
        {doc.applicationId && <Link className="btn" href={`/log/${doc.applicationId}`}>Quest</Link>}
        <a className="btn" href={`/print/${doc.id}`} target="_blank">PDF</a>
        <a className="btn primary" href={`/api/docs/${doc.id}`}>.docx</a>
      </PageHead>

      {unsupported.length > 0 && !edited && (
        <div className="alert">⚠ {unsupported.length} claim(s) not found in your Character Sheet (striped below)</div>
      )}
      {(doc.gaps ?? []).length > 0 && (
        <div className="alert"><Px name="bolt" /> {doc.gaps!.length} spot{doc.gaps!.length > 1 ? "s" : ""} to fill in (pink)</div>
      )}

      <div className="grid-2">
        <Win title="Draft" icon="doc">
          <div className="paper">
            {paragraphs.map((p, i) => {
              const cites = edited ? [] : doc.citations?.find((c) => c.sentence.trim() === p.trim())?.itemIds ?? [];
              return (
                <p key={i}>
                  {edited ? placeholders(p) : highlight(p, unsupported)}
                  {cites.map((c) => <span key={c} className="cite">{c}</span>)}
                </p>
              );
            })}
          </div>
        </Win>
        <div>
          {isRules && (
            <Win title="Checks" icon="check">
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }} className="stack">
                {(inputs.checks ?? []).map((c) => (
                  <li key={c.label}>
                    {c.ok ? "✓" : "✗"} {c.label}
                    {c.detail && <div className="meta" style={{ paddingLeft: 22 }}>{c.detail}</div>}
                  </li>
                ))}
              </ul>
            </Win>
          )}
          {isRules && (
            <Win title="Rewrite" icon="quill">
              <form action={rewordAction.bind(null, doc.id)} className="stack">
                <div className="row tight">
                  <Submit pendingText="Rewriting">↻ Different wording</Submit>
                </div>
              </form>
              <form action={rewordAction.bind(null, doc.id)} className="row tight" style={{ marginTop: 12 }}>
                <select name="storyId" defaultValue={inputs.storyAuto ? "auto" : String(inputs.storyId ?? "auto")} className="grow" aria-label="Story">
                  <option value="auto">Best-matching story</option>
                  {stories.map((st) => <option key={st.id} value={st.id}>{st.title}</option>)}
                </select>
                <select name="tone" defaultValue={inputs.tone ?? "warm"} style={{ width: 110 }} aria-label="Tone">
                  <option value="warm">Warm</option>
                  <option value="formal">Formal</option>
                </select>
                <Submit className="small">Apply</Submit>
              </form>
            </Win>
          )}
          {ai && (
            <Win title={isRules ? "Polish with AI" : "Refine"} icon="bolt">
              <form action={refineAction.bind(null, doc.id)} className="stack">
                <div className="row tight">
                  <Submit className="small" name="action" value="shorter" pendingText="…">Shorter</Submit>
                  <Submit className="small" name="action" value="specific" pendingText="…">More specific</Submit>
                  <Submit className="small" name="action" value="voice" pendingText="…">More like me</Submit>
                </div>
                <div className="row tight">
                  <input name="custom" placeholder="Or say what to change…" className="grow" />
                  <Submit className="small" name="action" value="custom" pendingText="…">Go</Submit>
                </div>
              </form>
            </Win>
          )}
          <Win title="Edit by hand" icon="quill">
            <form action={saveDocEdits.bind(null, doc.id)} className="stack">
              <input name="title" defaultValue={doc.title} />
              <textarea name="body" defaultValue={doc.body} rows={14} />
              <div className="row tight">
                <button className="primary">Save edits</button>
                <button formAction={saveDocToLibrary.bind(null, doc.id)} className="ghost">Save to Spellbook</button>
              </div>
            </form>
          </Win>
          <Win title="Attach to quest" icon="link">
            <form action={attachDoc.bind(null, doc.id)} className="row">
              <select name="applicationId" defaultValue={doc.applicationId ?? ""} className="grow">
                <option value="">—</option>
                {apps.map((a) => <option key={a.id} value={a.id}>{a.org}: {a.title}</option>)}
              </select>
              <button className="small">Attach</button>
            </form>
          </Win>
          {versions.length > 1 && (
            <Win title="Versions" icon="list">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {versions.map((v) => (
                  <li key={v.id}>{v.id === doc.id ? <b>v{v.version} (viewing)</b> : <Link href={`/forge?doc=${v.id}`}>v{v.version}</Link>} <small>{fmtDate(v.createdAt)}</small></li>
                ))}
              </ul>
            </Win>
          )}
          <form action={deleteDoc.bind(null, doc.id)}><button className="small ghost">Delete this version</button></form>
        </div>
      </div>
    </>
  );
}
