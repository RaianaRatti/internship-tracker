import type { SourceAdapter, NormalizedPosting } from "./types";
import { getJson } from "./http";
import { guessSeason, guessType } from "../core/classify-title";
import { stripHtml } from "../core/text";

type SrJob = {
  id: string;
  name: string;
  releasedDate?: string;
  company?: { identifier: string; name: string };
  location?: { fullLocation?: string; remote?: boolean };
  jobAd?: { sections?: Record<string, { text?: string }> };
};

export function normalizeSmartRecruiters(job: SrJob, company: string, org: string): NormalizedPosting {
  const sections = job.jobAd?.sections ?? {};
  const description = stripHtml(Object.values(sections).map((s) => s.text ?? "").join("\n"));
  const url = `https://jobs.smartrecruiters.com/${company}/${job.id}`;
  return {
    externalKey: `smartrecruiters:${company}:${job.id}`,
    type: guessType(job.name),
    title: job.name.trim(),
    org: job.company?.name ?? org,
    location: job.location?.fullLocation ?? null,
    remote: !!job.location?.remote,
    season: guessSeason(job.name),
    url,
    applyUrl: url,
    ats: "smartrecruiters",
    description: description || null,
    postedAt: job.releasedDate ? new Date(job.releasedDate) : null,
  };
}

export async function fetchSmartRecruitersJob(company: string, jobId: string) {
  const job = await getJson<SrJob>(`https://api.smartrecruiters.com/v1/companies/${company}/postings/${jobId}`);
  return normalizeSmartRecruiters(job, company, company);
}

export const smartrecruiters: SourceAdapter = {
  id: "smartrecruiters",
  label: "SmartRecruiters boards",
  scope: "company",
  async fetch({ company }) {
    if (!company) return [];
    const out: NormalizedPosting[] = [];
    // Server-side keyword search keeps this to student roles without paging the whole board.
    for (const q of ["intern", "co-op", "student", "graduate"]) {
      const data = await getJson<{ content: SrJob[] }>(
        `https://api.smartrecruiters.com/v1/companies/${company.boardId}/postings?q=${encodeURIComponent(q)}&limit=100`,
      );
      out.push(...data.content.map((j) => normalizeSmartRecruiters(j, company.boardId, company.name)));
    }
    return out;
  },
};
