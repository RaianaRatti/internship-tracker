import type { SourceAdapter, NormalizedPosting } from "./types";
import { getJson } from "./http";
import { guessSeason, guessType, isStudentRole } from "../core/classify-title";

type AshbyJob = {
  id: string;
  title: string;
  location?: string;
  employmentType?: string;
  isRemote?: boolean;
  workplaceType?: string;
  jobUrl: string;
  applyUrl: string;
  descriptionPlain?: string;
  publishedAt?: string;
  isListed?: boolean;
  compensation?: { compensationTierSummary?: string };
};

export function normalizeAshby(job: AshbyJob, board: string, org: string): NormalizedPosting {
  return {
    externalKey: `ashby:${board}:${job.id}`,
    type: job.employmentType === "Intern" ? guessType(job.title, "internship") : guessType(job.title),
    title: job.title.trim(),
    org,
    location: job.location ?? null,
    remote: !!job.isRemote || job.workplaceType === "Remote",
    season: guessSeason(`${job.title} ${(job.descriptionPlain ?? "").slice(0, 500)}`),
    url: job.jobUrl,
    applyUrl: job.applyUrl,
    ats: "ashby",
    description: job.descriptionPlain ?? null,
    compensation: job.compensation?.compensationTierSummary ?? null,
    postedAt: job.publishedAt ? new Date(job.publishedAt) : null,
  };
}

export async function fetchAshbyBoard(board: string) {
  const data = await getJson<{ jobs: AshbyJob[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`,
  );
  return data.jobs;
}

export const ashby: SourceAdapter = {
  id: "ashby",
  label: "Ashby job boards",
  scope: "company",
  async fetch({ company }) {
    if (!company) return [];
    const jobs = await fetchAshbyBoard(company.boardId);
    return jobs
      .filter((j) => j.isListed !== false && (j.employmentType === "Intern" || isStudentRole(j.title)))
      .map((j) => normalizeAshby(j, company.boardId, company.name));
  },
};
