import { saveStory, deleteStory } from "@/app/actions/spellbook";

type Story = { id: number; title: string; hook: string; action: string; lesson: string; theme: string; tags: string | null };

/** The five fields a rule-based letter needs from a story. The student writes them; nothing is generated. */
export function StoryForm({ story, from }: { story?: Story; from?: string }) {
  return (
    <form action={saveStory.bind(null, story?.id ?? null)} className="form" style={{ marginTop: 10 }}>
      {from && <input type="hidden" name="from" value={from} />}
      <label className="full">
        1 · The moment: open in the middle of it (1–3 sentences)
        <textarea name="hook" rows={3} defaultValue={story?.hook} placeholder="Two days before our robotics club's fall registration, our sign-up site started crashing every time more than twenty people opened it." />
      </label>
      <label className="full">
        2 · What you did
        <textarea name="action" rows={3} defaultValue={story?.action} placeholder="I stayed up profiling the page, found an image carousel re-rendering on every keystroke, and rewrote it so the page loaded in under a second." />
      </label>
      <label className="full">
        3 · What it taught you (one full sentence)
        <input name="lesson" defaultValue={story?.lesson} placeholder="I learned that the details users never see are often what decide whether they stay." />
      </label>
      <label>
        4 · A short name for it, used in the closing callback
        <input name="title" defaultValue={story?.title} placeholder="the week our club's site kept crashing" />
      </label>
      <label>
        5 · The quality it shows (2–5 words)
        <input name="theme" defaultValue={story?.theme} placeholder="patience with the invisible details" />
      </label>
      <label className="full">
        Keywords: help match this story to postings (optional)
        <input name="tags" defaultValue={story?.tags ?? ""} placeholder="debugging, performance, web, users" />
      </label>
      <div className="full row">
        <button className="primary">{story ? "Save" : "+ Add story"}</button>
        {story && <button className="small ghost right" formAction={deleteStory.bind(null, story.id)}>Delete</button>}
      </div>
    </form>
  );
}
