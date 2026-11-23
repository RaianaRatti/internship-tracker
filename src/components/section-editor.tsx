import { db } from "@/db";
import { SECTIONS, type SectionKey, type Field } from "@/lib/vault-sections";
import { saveSectionItem, deleteSectionItem } from "@/app/actions/vault";
import { Win, Empty } from "./ui";

function Input({ f, value }: { f: Field; value?: unknown }) {
  const v = (value as string | null) ?? "";
  if (f.type === "textarea") return <textarea name={f.name} defaultValue={v} rows={f.name === "bullets" ? 6 : 3} placeholder={f.hint} />;
  if (f.type === "select")
    return (
      <select name={f.name} defaultValue={v}>
        {f.options!.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
      </select>
    );
  return <input name={f.name} defaultValue={v} placeholder={f.hint} required={f.required} type={f.type === "url" ? "url" : "text"} />;
}

function ItemForm({ section, row }: { section: SectionKey; row?: Record<string, unknown> }) {
  const def = SECTIONS[section];
  return (
    <form action={saveSectionItem.bind(null, section, (row?.id as number) ?? null)} className="form" style={{ marginTop: 8 }}>
      {def.fields.map((f) => (
        <label key={f.name} className={f.type === "textarea" ? "full" : ""}>
          {f.label}
          <Input f={f} value={row?.[f.name]} />
        </label>
      ))}
      <div className="full row">
        <button className="primary">{row ? "Save" : "+ Add"}</button>
        {row && <button className="small ghost right" formAction={deleteSectionItem.bind(null, section, row.id as number)}>Delete</button>}
      </div>
    </form>
  );
}

/** Generic list editor for one Character Sheet section. Ids shown are what AI drafts cite. */
export async function SectionEditor({ section }: { section: SectionKey }) {
  const def = SECTIONS[section];
  const rows = (await db.select().from(def.table)) as Record<string, unknown>[];
  const prefix: Record<string, string> = { education: "edu", experiences: "exp", projects: "proj", activities: "act", links: "link" };
  return (
    <Win title={def.label} icon="list">
      {section === "skills" ? (
        <div style={{ marginBottom: 12 }}>
          {rows.map((r) => (
            <form key={r.id as number} action={deleteSectionItem.bind(null, section, r.id as number)} style={{ display: "inline" }}>
              <button className="small" style={{ margin: "0 6px 6px 0" }} title="Remove">{String(r.name)}{r.level ? ` · ${r.level}` : ""} ✕</button>
            </form>
          ))}
          {!rows.length && <Empty>No skills yet</Empty>}
        </div>
      ) : rows.length ? (
        rows.map((r) => (
          <details key={r.id as number} className="item">
            <summary>
              <b>{def.title(r)}</b> <span className="meta">{def.subtitle(r)}</span>
              {prefix[section] && <span className="cite">{prefix[section]}-{String(r.id)}</span>}
            </summary>
            <ItemForm section={section} row={r} />
          </details>
        ))
      ) : (
        <Empty>Nothing here yet</Empty>
      )}
      <details open={!rows.length} style={{ marginTop: 12 }}>
        <summary className="accent">Add {def.label.toLowerCase()}</summary>
        <ItemForm section={section} />
      </details>
    </Win>
  );
}
