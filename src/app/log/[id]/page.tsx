import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { STATUSES } from "@/db/schema";
import { Win, StatusBadge, Empty, fmtDate, TYPE_LABEL, Hint } from "@/components/ui";
import { Flash, type SP } from "@/components/flash";
import { Submit } from "@/components/submit";
import { STATUS_LABEL } from "@/lib/core/status";
import { DOC_KINDS, type DocKind } from "@/lib/ai/forge";
import {
  setStatusAction, updateApplication, addNote, addInterview, deleteInterview, saveOffer,
  addContact, deleteContact, addReminder, addAnswer, updateAnswer, deleteAnswer, deleteApplication,
} from "../../actions/tracker";

export default async function QuestDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id: raw } = await params;
  const sp = await searchParams;
  const id = Number(raw);
  const app = await db.query.applications.findFirst({ where: eq(schema.applications.id, id) });
  if (!app) notFound();
  const opp = (await db.query.opportunities.findFirst({ where: eq(schema.opportunities.id, app.opportunityId) }))!;

  const [events, interviews, offer, contacts, answers, docs, resumes, emails] = await Promise.all([
    db.select().from(schema.applicationEvents).where(eq(schema.applicationEvents.applicationId, id)).orderBy(desc(schema.applicationEvents.occurredAt)),
    db.select().from(schema.interviews).where(eq(schema.interviews.applicationId, id)).orderBy(asc(schema.interviews.scheduledAt)),
    db.query.offers.findFirst({ where: eq(schema.offers.applicationId, id) }),
    db.select().from(schema.contacts).where(eq(schema.contacts.applicationId, id)),
    db.select().from(schema.applicationAnswers).where(eq(schema.applicationAnswers.applicationId, id)),
    db.select().from(schema.generatedDocs).where(eq(schema.generatedDocs.applicationId, id)).orderBy(desc(schema.generatedDocs.createdAt)),
    db.select().from(schema.documents).where(eq(schema.documents.kind, "resume")),
    db.select().from(schema.emails).where(eq(schema.emails.applicationId, id)).orderBy(desc(schema.emails.receivedAt)),
  ]);
  const coverLetters = docs.filter((d) => d.kind === "cover_letter");
  const resume = resumes.find((r) => r.id === app.resumeDocumentId) ?? resumes.find((r) => r.isDefault);
  const cover = docs.find((d) => d.id === app.coverLetterId) ?? coverLetters[0];
  const forgeHref = (kind: DocKind) => `/forge?app=${id}&kind=${kind}`;

  return (
    <>
      <Link href="/log" className="back">← Quest Log</Link>
      <section className="win">
        <div className="win-body">
          <div className="row between" style={{ alignItems: "flex-start" }}>
            <div className="grow">
              <div className="eyebrow">{opp.org}</div>
              <h1 style={{ marginBottom: 10 }}>{opp.title}</h1>
              <div className="row tight">
                <StatusBadge status={app.status} />
                <span className="tag">{TYPE_LABEL[opp.type]}</span>
                {opp.season && <span className="tag">{opp.season}</span>}
                {opp.location && <span className="tag">{opp.location.split(";")[0]}</span>}
                {opp.deadline && <span className="tag inv">due {fmtDate(opp.deadline)}</span>}
                {opp.closedAt && <span className="tag d-hatch">closed</span>}
              </div>
            </div>
            <div className="row tight">
              {opp.url && <a className="btn" href={opp.url} target="_blank" rel="noreferrer">Posting ↗</a>}
              {opp.applyUrl && <a className="btn primary" href={opp.applyUrl} target="_blank" rel="noreferrer">Apply ↗</a>}
            </div>
          </div>
          <hr />
          <form action={setStatusAction.bind(null, id)} className="row tight">
            <select name="status" defaultValue={app.status} style={{ width: 170 }} aria-label="Status">
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <input name="detail" placeholder="Note (optional)" className="grow" style={{ minWidth: 160 }} />
            <button className="primary">Move</button>
          </form>
        </div>
      </section>
      <Flash sp={sp} />

      <div className="split">
        <div>
          <Win title="Apply" icon="doc">
            <dl className="kv">
              <dt>Resume</dt>
              <dd>
                {resume ? <a className="link" href={`/api/documents/${resume.id}`}>{resume.label}</a> : <span className="muted">none yet</span>}
                {" · "}
                <Link className="link meta" href={`/forge?tab=resume&app=${id}`}>{resume ? "tailor" : "build"}</Link>
              </dd>
              <dt>Cover letter</dt>
              <dd>
                {cover ? <Link className="link" href={`/forge?doc=${cover.id}`}>v{cover.version} · {fmtDate(cover.createdAt)}</Link> : <span className="muted">none yet</span>}
                {" · "}
                <Link className="link meta" href={`/forge?tab=letter&app=${id}`}>{cover ? "new" : "write"}</Link>
              </dd>
            </dl>

            <h3>Form questions</h3>
            {answers.map((a) => (
              <details key={a.id} className="item">
                <summary>{a.question}</summary>
                <form action={updateAnswer.bind(null, id, a.id)} className="stack" style={{ marginTop: 8 }}>
                  <textarea name="answer" defaultValue={a.answer} rows={4} />
                  <div className="row tight">
                    <button className="small">Save</button>
                    <label className="inline meta"><input type="checkbox" name="saveToBank" /> add to answer bank</label>
                    <button className="small ghost right" formAction={deleteAnswer.bind(null, id, a.id)}>Delete</button>
                  </div>
                </form>
              </details>
            ))}
            <form action={addAnswer.bind(null, id)} className="row tight" style={{ marginTop: 8 }}>
              <input name="question" placeholder="Paste a question from the form" className="grow" />
              <Submit className="small" pendingText="…">+ Fill</Submit>
            </form>

            <h3>More writing <Hint>Essays, short answers and emails use the AI writer (needs a Claude key).</Hint></h3>
            <div className="links-inline">
              {(Object.keys(DOC_KINDS) as DocKind[]).filter((k) => k !== "cover_letter").map((k) => (
                <Link key={k} className="btn small" href={forgeHref(k)}>{DOC_KINDS[k]}</Link>
              ))}
            </div>
          </Win>

          <Win title="Interviews" icon="star">
            {interviews.length === 0 && <Empty>None scheduled</Empty>}
            {interviews.map((iv) => (
              <div key={iv.id} className="item">
                <div className="row between">
                  <b>{iv.round}</b>
                  <span className="tag">{iv.scheduledAt ? iv.scheduledAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "unscheduled"}</span>
                </div>
                {(iv.format || iv.interviewers || iv.selfRating) && <div className="meta">{[iv.format, iv.interviewers, iv.selfRating && `felt ${iv.selfRating}/5`].filter(Boolean).join(" · ")}</div>}
                {iv.questions && <p className="pre" style={{ marginTop: 6 }}>{iv.questions}</p>}
                {iv.notes && <p className="pre meta">{iv.notes}</p>}
                <form action={deleteInterview.bind(null, id, iv.id)}><button className="small ghost">Delete</button></form>
              </div>
            ))}
            <details style={{ marginTop: 8 }}>
              <summary>Add a round</summary>
              <form action={addInterview.bind(null, id)} className="form" style={{ marginTop: 10 }}>
                <label>Round <input name="round" placeholder="Phone screen" required /></label>
                <label>When <input type="datetime-local" name="scheduledAt" /></label>
                <label>Format <input name="format" placeholder="Video" /></label>
                <label>With <input name="interviewers" /></label>
                <label>Felt (1–5) <input type="number" name="selfRating" min={1} max={5} /></label>
                <label className="full">Questions asked <textarea name="questions" rows={3} /></label>
                <label className="full">Notes <textarea name="notes" rows={2} /></label>
                <div className="full"><button className="primary">Add</button></div>
              </form>
            </details>
          </Win>

          <Win title="Details" icon="gear">
            <form action={updateApplication.bind(null, id)} className="form">
              <label>Deadline <input type="date" name="deadline" defaultValue={opp.deadline ?? ""} /></label>
              <label>Next step on <input type="date" name="nextActionAt" defaultValue={app.nextActionAt?.toISOString().slice(0, 10) ?? ""} /></label>
              <label>Resume used
                <select name="resumeDocumentId" defaultValue={app.resumeDocumentId ?? ""}>
                  <option value="">Default</option>
                  {resumes.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </label>
              <label>Cover letter used
                <select name="coverLetterId" defaultValue={app.coverLetterId ?? ""}>
                  <option value="">—</option>
                  {coverLetters.map((d) => <option key={d.id} value={d.id}>v{d.version} · {fmtDate(d.createdAt)}</option>)}
                </select>
              </label>
              <label>Applied via
                <select name="applyLevel" defaultValue={app.applyLevel ?? ""}>
                  <option value="">—</option>
                  <option value="L0">On my own</option>
                  <option value="L1">With packet</option>
                  <option value="L2">Extension autofill</option>
                  <option value="L3">Batch</option>
                </select>
              </label>
              <label>Priority
                <select name="priority" defaultValue={String(app.priority ?? 0)}>
                  <option value="0">Normal</option>
                  <option value="1">High</option>
                  <option value="2">Dream</option>
                </select>
              </label>
              <label className="full">Pay <input name="compensation" defaultValue={opp.compensation ?? ""} /></label>
              <label className="full">Notes <textarea name="notes" defaultValue={app.notes ?? ""} rows={3} /></label>
              <div className="full"><button className="primary">Save</button></div>
            </form>
          </Win>

          <Win title="Offer" icon="check" right={offer ? <Link className="link" href="/log?view=offers">compare</Link> : undefined}>
            <details open={!!offer || app.status === "offer"}>
              <summary>{offer ? "Offer details" : "Record an offer"}</summary>
              <form action={saveOffer.bind(null, id)} className="form" style={{ marginTop: 10 }}>
                <label>Hourly ($) <input type="number" step="0.01" name="hourly" defaultValue={offer?.hourly ?? ""} /></label>
                <label>Monthly stipend ($) <input type="number" name="monthlyStipend" defaultValue={offer?.monthlyStipend ?? ""} /></label>
                <label>Housing <input name="housing" defaultValue={offer?.housing ?? ""} /></label>
                <label>Relocation <input name="relocation" defaultValue={offer?.relocation ?? ""} /></label>
                <label>Decide by <input type="date" name="decisionDeadline" defaultValue={offer?.decisionDeadline ?? ""} /></label>
                <label>Decision
                  <select name="decision" defaultValue={offer?.decision ?? "pending"}>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="declined">Declined</option>
                  </select>
                </label>
                <label className="full">Perks <input name="other" defaultValue={offer?.other ?? ""} /></label>
                <label className="full">Notes <textarea name="notes" defaultValue={offer?.notes ?? ""} rows={2} /></label>
                <div className="full"><button className="primary">{offer ? "Update" : "Save offer"}</button></div>
              </form>
            </details>
          </Win>
        </div>

        <div>
          <Win title="Timeline" icon="clock">
            <form action={addNote.bind(null, id)} className="row tight" style={{ marginBottom: 14 }}>
              <input name="note" placeholder="Add a note" className="grow" />
              <button className="small">+</button>
            </form>
            {events.length ? (
              <ul className="timeline">
                {events.map((e) => (
                  <li key={e.id} className={e.origin}>
                    <div>{e.title}</div>
                    {e.detail && <div className="pre meta">{e.detail}</div>}
                    <div className="meta">{e.occurredAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No events yet</Empty>
            )}
          </Win>

          {emails.length > 0 && (
            <Win title="Emails" icon="mail">
              {emails.map((m) => (
                <div key={m.id} className="item">
                  <span className="tag">{m.classification?.replace(/_/g, " ")}</span> {m.subject}
                  <div className="meta">{fmtDate(m.receivedAt)}</div>
                </div>
              ))}
            </Win>
          )}

          <Win title="People" icon="user">
            {contacts.map((c) => (
              <div key={c.id} className="row between item">
                <span>
                  <b>{c.name}</b> {c.role && <span className="tag">{c.role}</span>}
                  <div className="meta">
                    {c.email && <a className="link" href={`mailto:${c.email}`}>{c.email}</a>}
                    {c.linkedin && <> · <a className="link" href={c.linkedin} target="_blank" rel="noreferrer">LinkedIn</a></>}
                  </div>
                </span>
                <form action={deleteContact.bind(null, id, c.id)}><button className="small ghost" aria-label="Remove">✕</button></form>
              </div>
            ))}
            <details>
              <summary>Add someone</summary>
              <form action={addContact.bind(null, id)} className="stack" style={{ marginTop: 10 }}>
                <input name="name" placeholder="Name" required />
                <select name="role">
                  <option value="recruiter">Recruiter</option>
                  <option value="interviewer">Interviewer</option>
                  <option value="referrer">Referrer</option>
                  <option value="pi">Professor / PI</option>
                </select>
                <input name="email" type="email" placeholder="Email" />
                <input name="linkedin" placeholder="LinkedIn URL" />
                <input type="hidden" name="companyName" value={opp.org} />
                <button className="primary">Add</button>
              </form>
            </details>
          </Win>

          <Win title="Remind me" icon="bolt">
            <form action={addReminder.bind(null, id)} className="stack">
              <input name="text" placeholder="Follow up with recruiter" />
              <div className="row tight">
                <input type="date" name="dueAt" className="grow" />
                <button className="small primary">Set</button>
              </div>
            </form>
          </Win>

          {opp.description && (
            <Win title="Posting" icon="search">
              <details>
                <summary>Show description</summary>
                <div className="pre meta" style={{ marginTop: 8, maxHeight: 480, overflowY: "auto" }}>{opp.description}</div>
              </details>
            </Win>
          )}

          <form action={deleteApplication.bind(null, id)} style={{ marginTop: 18 }}>
            <button className="small ghost">Delete this quest</button>
          </form>
        </div>
      </div>
    </>
  );
}
