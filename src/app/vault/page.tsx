import Link from "next/link";
import { db, schema } from "@/db";
import { Win, Empty, fmtDate, PageHead, Hint } from "@/components/ui";
import { Px, type IconName } from "@/components/px";
import { sql } from "drizzle-orm";
import { Flash, type SP } from "@/components/flash";
import { Submit } from "@/components/submit";
import { SectionEditor } from "@/components/section-editor";
import { SECTIONS, type SectionKey } from "@/lib/vault-sections";
import { getProfile, getSetting } from "@/lib/settings";
import { decrypt } from "@/lib/crypto";
import { aiConfigured } from "@/lib/ai/client";
import type { ResumeImportData } from "@/lib/ai/resume";
import { saveProfile, saveEeo, uploadDocument, setDefaultResume, deleteDocument, importResume, confirmImport, discardImport } from "../actions/vault";

const TABS: [string, string, IconName][] = [
  ["profile", "Basics", "user"],
  ["education", "Education", "book"],
  ["experiences", "Experience", "flag"],
  ["projects", "Projects", "star"],
  ["skills", "Skills", "bolt"],
  ["activities", "Activities", "list"],
  ["links", "Links", "link"],
  ["recommenders", "Recommenders", "mail"],
  ["documents", "Documents", "doc"],
  ["import", "Import resume", "plus"],
  ["eeo", "Private (EEO)", "gear"],
];

export default async function Vault({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab = sp.tab ?? "profile";
  const counts = Object.fromEntries(
    await Promise.all(
      [...(Object.keys(SECTIONS) as SectionKey[]).map((k) => [k, SECTIONS[k].table] as const), ["documents", schema.documents] as const].map(
        async ([k, t]) => [k, Number((await db.select({ n: sql<number>`count(*)` }).from(t))[0].n)] as const,
      ),
    ),
  ) as Record<string, number>;
  return (
    <>
      <PageHead icon="user" title="Character Sheet" sub="Fill it once; letters, resumes and autofill reuse it" />
      <Flash sp={sp} />
      <div className="side-layout">
        <nav className="side-tabs" aria-label="Sections">
          {TABS.map(([k, l, icon]) => (
            <Link key={k} href={`/vault?tab=${k}`} aria-current={tab === k ? "page" : undefined}>
              <Px name={icon} />
              {l}
              {counts[k] !== undefined && <span className="count">{counts[k]}</span>}
            </Link>
          ))}
        </nav>
        <div>
          {tab === "profile" && <Basics />}
          {tab in SECTIONS && <SectionEditor section={tab as SectionKey} />}
          {tab === "documents" && <Documents />}
          {tab === "import" && <Import />}
          {tab === "eeo" && <Eeo />}
        </div>
      </div>
    </>
  );
}

async function Basics() {
  const p = await getProfile();
  return (
    <Win title="Basics" icon="user">
      <form action={saveProfile} className="form">
        <label>Full name <input name="name" defaultValue={p.name} required /></label>
        <label>Pronouns <input name="pronouns" defaultValue={p.pronouns ?? ""} /></label>
        <label>Email <input name="email" type="email" defaultValue={p.email ?? ""} /></label>
        <label>Phone <input name="phone" defaultValue={p.phone ?? ""} /></label>
        <label>Location <input name="location" defaultValue={p.location ?? ""} placeholder="Pittsburgh, PA" /></label>
        <label>Class year
          <select name="classYear" defaultValue={p.classYear ?? ""}>
            {["", "freshman", "sophomore", "junior", "senior", "grad"].map((y) => <option key={y} value={y}>{y || "—"}</option>)}
          </select>
        </label>
        <label>Graduation <input name="graduationDate" defaultValue={p.graduationDate ?? ""} placeholder="May 2028" /></label>
        <label>Work authorization <input name="workAuthorization" defaultValue={p.workAuthorization ?? ""} placeholder="US citizen / F-1 / permanent resident" /></label>
        <label className="inline"><input type="checkbox" name="needsSponsorship" defaultChecked={!!p.needsSponsorship} /> Need visa sponsorship</label>
        <label className="inline"><input type="checkbox" name="willingToRelocate" defaultChecked={p.willingToRelocate ?? true} /> Willing to relocate</label>
        <label className="full">Headline <input name="headline" defaultValue={p.headline ?? ""} placeholder="CS sophomore into systems + ML research" /></label>
        <label className="full">Summary (in your words) <textarea name="summary" defaultValue={p.summary ?? ""} rows={4} /></label>
        <div className="full"><button className="primary">SAVE</button></div>
      </form>
    </Win>
  );
}

async function Documents() {
  const docs = await db.select().from(schema.documents);
  return (
    <Win title="Documents" icon="doc" right={<Link className="link" href="/forge?tab=resume">build a resume</Link>}>
      {docs.length ? (
        <table>
          <thead><tr><th>LABEL</th><th>KIND</th><th>FILE</th><th>ADDED</th><th></th></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>{d.label} {d.isDefault && <span className="tag inv">DEFAULT</span>}</td>
                <td>{d.kind}</td>
                <td><a href={`/api/documents/${d.id}`}>{d.filename}</a></td>
                <td>{fmtDate(d.createdAt)}</td>
                <td className="row" style={{ gap: 6 }}>
                  {d.kind === "resume" && !d.isDefault && <form action={setDefaultResume.bind(null, d.id)}><button className="small">MAKE DEFAULT</button></form>}
                  <form action={deleteDocument.bind(null, d.id)}><button className="small ghost">DELETE</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty>No files yet</Empty>
      )}
      <form action={uploadDocument} className="form" style={{ marginTop: 14 }}>
        <label>File <input type="file" name="file" required /></label>
        <label>Label <input name="label" placeholder="Resume — SWE v3" /></label>
        <label>Kind
          <select name="kind">
            <option value="resume">Resume</option>
            <option value="transcript">Transcript</option>
            <option value="portfolio">Portfolio</option>
            <option value="other">Other</option>
          </select>
        </label>
        <div className="full"><Submit className="primary" pendingText="UPLOADING">UPLOAD</Submit></div>
      </form>
    </Win>
  );
}

async function Import() {
  const raw = await getSetting("resume_import_draft");
  if (!raw) {
    return (
      <Win title="Import a resume" icon="plus" right={<Hint>AI reads your resume, then you tick which items to keep. Nothing is saved until you confirm.</Hint>}>
        {!aiConfigured() && <div className="alert warn">Resume import uses the Claude API. Add ANTHROPIC_API_KEY to .env.local.</div>}
        <form action={importResume} className="stack">
          <label>Resume PDF <input type="file" name="file" accept="application/pdf" /></label>
          <label>…or paste text <textarea name="text" rows={8} /></label>
          <Submit className="primary" pendingText="READING">PARSE RESUME</Submit>
        </form>
      </Win>
    );
  }
  const d = JSON.parse(raw) as ResumeImportData;
  const Item = ({ name, children }: { name: string; children: React.ReactNode }) => (
    <label className="inline" style={{ alignItems: "flex-start", padding: "4px 0", borderBottom: "2px dashed var(--line)" }}>
      <input type="checkbox" name={name} defaultChecked />
      <span>{children}</span>
    </label>
  );
  return (
    <Win title="Confirm import" icon="check">
      <form action={confirmImport} className="stack">
        <h3>PROFILE</h3>
        <Item name="profile">{d.profile.name} · {d.profile.email} · {d.profile.phone} · {d.profile.location}<br /><small>{d.profile.headline}</small></Item>
        {(["education", "experiences", "projects", "activities", "links", "skills"] as const).map((k) =>
          d[k].length ? (
            <div key={k}>
              <h3>{k.toUpperCase()}</h3>
              {d[k].map((item, i) => (
                <Item key={i} name={`${k}-${i}`}>
                  {k === "experiences" ? (
                    <>
                      <b>{(item as ResumeImportData["experiences"][number]).role} @ {(item as ResumeImportData["experiences"][number]).org}</b>
                      <ul style={{ margin: "4px 0" }}>{(item as ResumeImportData["experiences"][number]).bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
                    </>
                  ) : (
                    <span>{Object.values(item).filter(Boolean).join(" · ")}</span>
                  )}
                </Item>
              ))}
            </div>
          ) : null,
        )}
        <div className="row">
          <button className="primary">ADD CHECKED ITEMS</button>
          <button className="ghost" formAction={discardImport}>DISCARD</button>
        </div>
      </form>
    </Win>
  );
}

async function Eeo() {
  const p = await getProfile();
  const data: Record<string, string> = p.eeoEncrypted ? JSON.parse(decrypt(p.eeoEncrypted)) : {};
  const fields = [
    ["gender", "Gender"],
    ["race", "Race / ethnicity"],
    ["veteran", "Veteran status"],
    ["disability", "Disability status"],
    ["firstGen", "First-generation student"],
  ];
  return (
    <Win title="Private (EEO)" icon="gear">
      <p className="meta">Optional · encrypted on this computer · only used for autofill · never sent to AI</p>
      <form action={saveEeo} className="form">
        {fields.map(([k, l]) => (
          <label key={k}>{l} <input name={`eeo_${k}`} defaultValue={data[k] ?? ""} placeholder="Decline to self-identify" /></label>
        ))}
        <div className="full"><button className="primary">SAVE</button></div>
      </form>
    </Win>
  );
}
