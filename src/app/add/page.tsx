import { OPPORTUNITY_TYPES, STATUSES } from "@/db/schema";
import { Win, TYPE_LABEL, PageHead, Hint } from "@/components/ui";
import { Flash, type SP } from "@/components/flash";
import { Submit } from "@/components/submit";
import { addManual } from "../actions/tracker";
import { STATUS_LABEL } from "@/lib/core/status";

export default async function AddQuest({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <>
      <PageHead icon="plus" title="Add a quest" sub="Paste a link, or add anything by hand" />
      <Flash sp={sp} />
      <div className="grid-2">
        <Win title="From a link" icon="link" right={<Hint>Greenhouse, Lever, Ashby, SmartRecruiters and Workday links are read directly. For LinkedIn or Handshake, also paste the text (or use the browser extension).</Hint>}>
          <form action={addManual} className="stack">
            <label>URL <input name="url" type="url" placeholder="https://jobs.lever.co/…" required /></label>
            <label>Posting text (optional) <textarea name="text" rows={4} placeholder="Only needed if the page needs a login" /></label>
            <div className="form">
              <label>Deadline <input type="date" name="deadline" /></label>
              <label>Status
                <select name="status" defaultValue="saved">
                  {STATUSES.slice(0, 3).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </label>
            </div>
            <div><Submit className="primary" pendingText="Reading">Import</Submit></div>
          </form>
        </Win>

        <Win title="By hand" icon="doc" right={<Hint>For labs, scholarships, fellowships, hackathons, anything without a posting page.</Hint>}>
          <form action={addManual} className="form">
            <label className="full">Title <input name="title" required placeholder="Undergraduate researcher — Vision Lab" /></label>
            <label>Organization <input name="org" required placeholder="Stanford / Prof. Smith" /></label>
            <label>Type
              <select name="type" defaultValue="internship">
                {OPPORTUNITY_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </label>
            <label>Location <input name="location" /></label>
            <label>Deadline <input type="date" name="deadline" /></label>
            <label>Link <input name="url" type="url" /></label>
            <label>Status
              <select name="status" defaultValue="saved">
                {STATUSES.slice(0, 3).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            <label className="full">Description / requirements <textarea name="text" rows={5} /></label>
            <div className="full"><Submit className="primary">Add</Submit></div>
          </form>
        </Win>
      </div>
    </>
  );
}
