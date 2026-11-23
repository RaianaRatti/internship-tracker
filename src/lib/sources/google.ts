import type { SourceAdapter, NormalizedPosting } from "./types";
import { politeFetch } from "./http";
import { guessSeason, guessType } from "../core/classify-title";
import { stripHtml } from "../core/text";

// Google's careers page embeds results in an AF_initDataCallback 'ds:1' blob. This is the most
// fragile adapter (PLAN.md §5.2); the SimplifyJobs list is the fallback when it breaks.
type Row = unknown[];

export function parseGoogleCareersHtml(html: string): NormalizedPosting[] {
  const m = html.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '\d+', data:([\s\S]*?), sideChannel: \{\}\}\);<\/script>/);
  if (!m) throw new Error("Google careers page layout changed: ds:1 block not found");
  const data = JSON.parse(m[1]) as [Row[] | null];
  const rows = data[0] ?? [];
  return rows.map((r) => {
    const id = String(r[0]);
    const title = String(r[1]);
    const text = (i: number) => (Array.isArray(r[i]) ? String((r[i] as unknown[])[1] ?? "") : "");
    const locations = Array.isArray(r[9]) ? (r[9] as unknown[][]).map((l) => String(l[0])) : [];
    const description = stripHtml([text(10), text(3), text(4), text(19)].join("\n"));
    const location = locations.join("; ");
    return {
      externalKey: `google:${id}`,
      type: guessType(title),
      title,
      org: "Google",
      location,
      remote: /remote/i.test(location),
      season: guessSeason(`${title} ${description.slice(0, 400)}`),
      url: `https://www.google.com/about/careers/applications/jobs/results/${id}`,
      applyUrl: `https://www.google.com/about/careers/applications/jobs/results/${id}`,
      ats: "google",
      description,
    };
  });
}

export const google: SourceAdapter = {
  id: "google",
  label: "Google Careers",
  scope: "global",
  async fetch() {
    const out: NormalizedPosting[] = [];
    for (let page = 1; page <= 5; page++) {
      const res = await politeFetch(
        `https://www.google.com/about/careers/applications/jobs/results/?target_level=INTERN_AND_APPRENTICE&page=${page}`,
        { headers: { Accept: "text/html" } },
      );
      if (!res.ok) throw new Error(`Google careers returned ${res.status}`);
      const jobs = parseGoogleCareersHtml(await res.text());
      out.push(...jobs);
      if (jobs.length < 20) break;
    }
    return out;
  },
};
