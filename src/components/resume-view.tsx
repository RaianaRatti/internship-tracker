import type { ResumeDoc } from "@/lib/rules/resume";

/** Clean, ATS-friendly resume layout (exports never use the pixel style). */
export function ResumeView({ doc }: { doc: ResumeDoc }) {
  return (
    <article className="resume">
      <header>
        <h1>{doc.name}</h1>
        <p>{doc.contact.join("  |  ")}</p>
      </header>
      {doc.sections.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          {s.items.map((it, i) => (
            <div key={i} className="ri">
              <div className="rl"><b>{it.title}</b><span>{it.right}</span></div>
              {it.sub && <div className="rl"><i>{it.sub}</i><i>{it.subRight}</i></div>}
              {it.bullets.length > 0 && <ul>{it.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>}
            </div>
          ))}
          {s.lines?.map((l) => {
            const [h, ...rest] = l.split(": ");
            return <p key={l}><b>{h}:</b> {rest.join(": ")}</p>;
          })}
        </section>
      ))}
    </article>
  );
}
