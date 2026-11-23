import type { SourceAdapter, NormalizedPosting } from "./types";
import { getJson } from "./http";
import { guessSeason, guessType, isStudentRole } from "../core/classify-title";
import { stripHtml } from "../core/text";

type GhJob = {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  content?: string;
  company_name?: string;
  first_published?: string;
  updated_at?: string;
};

export function normalizeGreenhouse(job: GhJob, board: string, org: string): NormalizedPosting {
  const description = stripHtml(job.content ? decodeEntities(job.content) : "");
  const loc = job.location?.name ?? null;
  return {
    externalKey: `greenhouse:${board}:${job.id}`,
    type: guessType(job.title),
    title: job.title.trim(),
    org: job.company_name || org,
    location: loc,
    remote: /remote/i.test(loc ?? ""),
    season: guessSeason(`${job.title} ${description.slice(0, 500)}`),
    url: job.absolute_url,
    applyUrl: job.absolute_url,
    ats: "greenhouse",
    description,
    postedAt: job.first_published ? new Date(job.first_published) : null,
  };
}

// Greenhouse returns HTML-escaped HTML in `content`.
function decodeEntities(s: string) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

export async function fetchGreenhouseJob(board: string, jobId: string, org = board) {
  const job = await getJson<GhJob>(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${jobId}`);
  return normalizeGreenhouse(job, board, org);
}

export const greenhouse: SourceAdapter = {
  id: "greenhouse",
  label: "Greenhouse job boards",
  scope: "company",
  async fetch({ company }) {
    if (!company) return [];
    const data = await getJson<{ jobs: GhJob[] }>(
      `https://boards-api.greenhouse.io/v1/boards/${company.boardId}/jobs?content=true`,
    );
    return data.jobs.filter((j) => isStudentRole(j.title)).map((j) => normalizeGreenhouse(j, company.boardId, company.name));
  },
};
