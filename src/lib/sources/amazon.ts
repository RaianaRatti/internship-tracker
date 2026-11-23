import type { SourceAdapter } from "./types";
import { getJson } from "./http";
import { guessSeason, guessType, isStudentRole } from "../core/classify-title";
import { stripHtml } from "../core/text";

// Big-tech custom adapter (PLAN.md §5.2): amazon.jobs serves its search results as JSON.
type AmazonJob = {
  id_icims: string;
  title: string;
  normalized_location?: string;
  location?: string;
  job_path: string;
  url_next_step?: string;
  description?: string;
  basic_qualifications?: string;
  preferred_qualifications?: string;
  posted_date?: string;
  company_name?: string;
};

export const amazon: SourceAdapter = {
  id: "amazon",
  label: "Amazon (amazon.jobs)",
  scope: "global",
  async fetch() {
    const out = [];
    for (let offset = 0; offset < 500; offset += 100) {
      const data = await getJson<{ hits: number; jobs: AmazonJob[] }>(
        `https://www.amazon.jobs/en/search.json?base_query=intern&business_category[]=studentprograms&result_limit=100&offset=${offset}&sort=recent`,
      );
      for (const j of data.jobs) {
        if (!isStudentRole(j.title)) continue;
        const description = stripHtml(
          [j.description, "Basic qualifications:", j.basic_qualifications, "Preferred qualifications:", j.preferred_qualifications].join("\n"),
        );
        out.push({
          externalKey: `amazon:${j.id_icims}`,
          type: guessType(j.title),
          title: j.title,
          org: "Amazon",
          location: j.normalized_location ?? j.location ?? null,
          remote: /virtual|remote/i.test(j.location ?? ""),
          season: guessSeason(j.title),
          url: `https://www.amazon.jobs${j.job_path}`,
          applyUrl: j.url_next_step ?? `https://www.amazon.jobs${j.job_path}`,
          ats: "amazon",
          description,
          postedAt: j.posted_date ? new Date(j.posted_date) : null,
        });
      }
      if (offset + 100 >= data.hits) break;
    }
    return out;
  },
};
