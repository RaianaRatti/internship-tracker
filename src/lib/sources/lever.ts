import type { SourceAdapter, NormalizedPosting } from "./types";
import { getJson } from "./http";
import { guessSeason, guessType, isStudentRole } from "../core/classify-title";

type LeverJob = {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl: string;
  createdAt?: number;
  categories?: { location?: string; commitment?: string; team?: string };
  workplaceType?: string;
  descriptionPlain?: string;
  additionalPlain?: string;
  lists?: { text: string; content: string }[];
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
};

export function normalizeLever(job: LeverJob, company: string, org: string): NormalizedPosting {
  const lists = (job.lists ?? []).map((l) => `${l.text}\n${l.content.replace(/<[^>]+>/g, " ")}`).join("\n\n");
  const description = [job.descriptionPlain, lists, job.additionalPlain].filter(Boolean).join("\n\n");
  const comp = job.salaryRange?.min
    ? `${job.salaryRange.currency ?? ""} ${job.salaryRange.min}–${job.salaryRange.max ?? ""} ${job.salaryRange.interval ?? ""}`.trim()
    : null;
  return {
    externalKey: `lever:${company}:${job.id}`,
    type: guessType(`${job.text} ${job.categories?.commitment ?? ""}`),
    title: job.text.trim(),
    org,
    location: job.categories?.location ?? null,
    remote: job.workplaceType === "remote" || /remote/i.test(job.categories?.location ?? ""),
    season: guessSeason(`${job.text} ${description.slice(0, 500)}`),
    url: job.hostedUrl,
    applyUrl: job.applyUrl,
    ats: "lever",
    description,
    compensation: comp,
    postedAt: job.createdAt ? new Date(job.createdAt) : null,
  };
}

export async function fetchLeverJob(company: string, jobId: string) {
  const job = await getJson<LeverJob>(`https://api.lever.co/v0/postings/${company}/${jobId}`);
  return normalizeLever(job, company, company);
}

export const lever: SourceAdapter = {
  id: "lever",
  label: "Lever job boards",
  scope: "company",
  async fetch({ company }) {
    if (!company) return [];
    const jobs = await getJson<LeverJob[]>(`https://api.lever.co/v0/postings/${company.boardId}?mode=json`);
    return jobs
      .filter((j) => isStudentRole(`${j.text} ${j.categories?.commitment ?? ""}`))
      .map((j) => normalizeLever(j, company.boardId, company.name));
  },
};
