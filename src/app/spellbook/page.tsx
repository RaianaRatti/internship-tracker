import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { Win, Empty, fmtDate, PageHead, Hint } from "@/components/ui";
import { Px } from "@/components/px";
import { Flash, type SP } from "@/components/flash";
import { Submit } from "@/components/submit";
import { getProfile } from "@/lib/settings";
import { aiConfigured } from "@/lib/ai/client";
import { StoryForm } from "@/components/story-form";
import { saveSample, deleteSample, saveAnswer, deleteAnswerBank, rebuildVoice } from "../actions/spellbook";

const TAGS = ["why-company", "challenge", "leadership", "diversity", "research-interest", "failure", "teamwork", "personal-statement", "cover-letter"];

export default async function Spellbook({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab = sp.tab === "answers" ? "answers" : sp.tab === "stories" ? "stories" : "samples";
  return (
    <>
      <PageHead icon="book" title="Spellbook" sub="Stories, writing and saved answers" />
      <Flash sp={sp} />
      <nav className="tabs">
        <Link href="/spellbook?tab=stories" aria-current={tab === "stories" ? "page" : undefined}><Px name="quill" /> Stories</Link>
        <Link href="/spellbook" aria-current={tab === "samples" ? "page" : undefined}><Px name="doc" /> Writing</Link>
        <Link href="/spellbook?tab=answers" aria-current={tab === "answers" ? "page" : undefined}><Px name="check" /> Answers</Link>
      </nav>
      {tab === "stories" ? <Stories /> : tab === "samples" ? <Samples /> : <Answers />}
    </>
  );
}

async function Stories() {
  const stories = await db.select().from(schema.stories).orderBy(desc(schema.stories.createdAt));
  return (
    <>
      <Win
        title={`Stories · ${stories.length}`}
        icon="quill"
        right={<Hint>Every cover letter opens with a story, connects its lesson to the role, then calls back to it. Small and specific works best: one bug, one night, one conversation.</Hint>}
      >
        {stories.map((s) => (
          <details key={s.id} className="item">
            <summary>
              <b>{s.title}</b> <span className="tag">{s.theme}</span>
            </summary>
            <StoryForm story={s} />
          </details>
        ))}
        <details open={!stories.length} style={{ marginTop: 10 }}>
          <summary className="accent">Write a story</summary>
          <StoryForm />
        </details>
      </Win>
    </>
  );
}

async function Samples() {
  const [samples, profile] = await Promise.all([db.select().from(schema.writingSamples).orderBy(desc(schema.writingSamples.createdAt)), getProfile()]);
  return (
    <>
      <div className="split">
      <Win title={`Writing · ${samples.length}`} icon="doc">
        {samples.map((s) => (
          <details key={s.id} className="item">
            <summary>
              <b>{s.title}</b> <span className="meta">{s.wordCount}w</span>{" "}
              {(s.tags ?? "").split(",").filter(Boolean).map((t) => <span key={t} className="tag">{t.trim()}</span>)}
            </summary>
            <form action={saveSample.bind(null, s.id)} className="form" style={{ marginTop: 8 }}>
              <label>Title <input name="title" defaultValue={s.title} /></label>
              <label>Tags <input name="tags" defaultValue={s.tags ?? ""} /></label>
              <label className="full">Original prompt <input name="prompt" defaultValue={s.prompt ?? ""} /></label>
              <label className="full">Text <textarea name="body" defaultValue={s.body} rows={10} /></label>
              <div className="full row">
                <button className="primary">Save</button>
                <button className="small ghost right" formAction={deleteSample.bind(null, s.id)}>Delete</button>
              </div>
            </form>
          </details>
        ))}
        <details open={!samples.length} style={{ marginTop: 12 }}>
          <summary className="accent">Add writing</summary>
          <form action={saveSample.bind(null, null)} className="form" style={{ marginTop: 8 }}>
            <label>Title <input name="title" required placeholder="Why Stripe essay (2026)" /></label>
            <label>Tags <input name="tags" list="tags" placeholder="why-company, challenge" /></label>
            <datalist id="tags">{TAGS.map((t) => <option key={t} value={t} />)}</datalist>
            <label className="full">Original prompt <input name="prompt" placeholder="What draws you to this role?" /></label>
            <label className="full">Text <textarea name="body" rows={10} required /></label>
            <div className="full"><button className="primary">+ Add</button></div>
          </form>
        </details>
      </Win>
      <Win
        title="Your voice"
        icon="user"
        right={aiConfigured() && samples.length > 0 && (
          <form action={rebuildVoice}><Submit className="small" pendingText="…">↻ Rebuild</Submit></form>
        )}
      >
        {profile.voiceProfile ? <div className="pre meta">{profile.voiceProfile}</div> : <Empty>Add writing to build it (AI)</Empty>}
      </Win>
      </div>
    </>
  );
}

async function Answers() {
  const answers = await db.select().from(schema.answerBank).orderBy(desc(schema.answerBank.createdAt));
  const starters = ["Why do you want to work here?", "Describe a project you're proud of.", "Tell us about a time you overcame a challenge.", "Are you authorized to work in the US?", "When can you start? How long can you intern?", "How did you hear about us?"];
  return (
    <Win title={`Saved answers · ${answers.length}`} icon="check" right={<Hint>When a form asks a question, the closest saved answer is used.</Hint>}>
      {answers.map((a) => (
        <details key={a.id} className="item">
          <summary><b>{a.question}</b> {a.lastUsedAt && <span className="meta">used {fmtDate(a.lastUsedAt)}</span>}</summary>
          <form action={saveAnswer.bind(null, a.id)} className="stack" style={{ marginTop: 8 }}>
            <input name="question" defaultValue={a.question} />
            <textarea name="answer" defaultValue={a.answer} rows={5} />
            <input name="tags" defaultValue={a.tags ?? ""} placeholder="tags" />
            <div className="row">
              <button className="primary">SAVE</button>
              <button className="small ghost right" formAction={deleteAnswerBank.bind(null, a.id)}>DELETE</button>
            </div>
          </form>
        </details>
      ))}
      <details open={!answers.length} style={{ marginTop: 10 }}>
        <summary className="accent">Add an answer</summary>
        <form action={saveAnswer.bind(null, null)} className="stack" style={{ marginTop: 8 }}>
          <input name="question" list="starters" placeholder="Question" required />
          <datalist id="starters">{starters.map((s) => <option key={s} value={s} />)}</datalist>
          <textarea name="answer" rows={5} placeholder="Your answer" required />
          <input name="tags" placeholder="tags (optional)" />
          <button className="primary">+ ADD</button>
        </form>
      </details>
    </Win>
  );
}
