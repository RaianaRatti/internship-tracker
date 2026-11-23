import { z } from "zod";
import type { NormalizedPosting } from "./types";
import { politeFetch } from "./http";
import { fetchGreenhouseJob } from "./greenhouse";
import { fetchLeverJob } from "./lever";
import { fetchAshbyBoard, normalizeAshby } from "./ashby";
import { fetchSmartRecruitersJob } from "./smartrecruiters";
import { fetchWorkdayJob, parseWorkdayUrl } from "./workday";
import { guessSeason, guessType } from "../core/classify-title";
import { stripHtml } from "../core/text";
import { aiConfigured, extract } from "../ai/client";
import { OPPORTUNITY_TYPES } from "@/db/schema";

/**
 * Paste a URL -> structured posting (PLAN.md §3.3 "Manual add"). Known ATS URLs go through
 * their JSON APIs; anything else tries schema.org JobPosting markup, then AI parsing.
 */
export async function importFromUrl(url: string, pageText?: string): Promise<NormalizedPosting> {
  try {
    const viaAts = await importFromAtsApi(url);
    if (viaAts) return viaAts;
  } catch {
    // Posting removed from the ATS API or URL shape we don't know; fall back to the page itself.
  }
  return importFromPage(url, pageText);
}

async function importFromAtsApi(url: string): Promise<NormalizedPosting | null> {
  const u = new URL(url);
  const parts = u.pathname.split("/").filter(Boolean);

  const ghId = u.searchParams.get("gh_jid");
  if (/greenhouse\.io$/.test(u.hostname)) {
    const jobsIdx = parts.indexOf("jobs");
    if (jobsIdx > 0) return fetchGreenhouseJob(parts[jobsIdx - 1], parts[jobsIdx + 1]);
    const board = u.searchParams.get("for");
    if (board && ghId) return fetchGreenhouseJob(board, ghId);
  }
  if (u.hostname === "jobs.lever.co" && parts.length >= 2) return fetchLeverJob(parts[0], parts[1]);
  if (u.hostname === "jobs.ashbyhq.com" && parts.length >= 2) {
    const job = (await fetchAshbyBoard(parts[0])).find((j) => j.id === parts[1]);
    if (job) return normalizeAshby(job, parts[0], parts[0]);
  }
  if (u.hostname === "jobs.smartrecruiters.com" && parts.length >= 2) return fetchSmartRecruitersJob(parts[0], parts[1].split("-")[0]);
  const wd = parseWorkdayUrl(url);
  if (wd?.jobPath) return fetchWorkdayJob(wd.boardId, wd.jobPath, wd.boardId.split("/")[0]);
  return null;
}

async function importFromPage(url: string, pageText?: string): Promise<NormalizedPosting> {
  const u = new URL(url);
  let html = "";
  if (!pageText) {
    const res = await politeFetch(url, { headers: { Accept: "text/html" } });
    if (!res.ok) throw new Error(`Could not fetch the page (${res.status}${res.status === 404 ? ", the posting may be closed" : ""}). Paste the posting text instead.`);
    html = await res.text();
    const ld = jobPostingFromJsonLd(html, url);
    if (ld) return ld;
  }
  const text = pageText ?? stripHtml(html);
  if (!aiConfigured()) {
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ?? "Untitled opportunity";
    return { externalKey: `manual:${url}`, type: guessType(title), title, org: u.hostname.replace(/^www\./, ""), url, applyUrl: url, description: text.slice(0, 20_000) };
  }
  return parseWithAi(text, url);
}

const Parsed = z.object({
  title: z.string(),
  org: z.string(),
  type: z.enum(OPPORTUNITY_TYPES),
  location: z.string().nullable(),
  remote: z.boolean(),
  season: z.string().nullable().describe("e.g. 'Summer 2027'"),
  deadline: z.string().nullable().describe("ISO date YYYY-MM-DD if stated"),
  compensation: z.string().nullable(),
  description: z.string().describe("The posting's description, responsibilities and qualifications, cleaned up"),
});

export async function parseWithAi(text: string, url: string): Promise<NormalizedPosting> {
  const p = await extract(Parsed, {
    system: "Extract this opportunity posting (job, internship, research program, fellowship, scholarship or event). Use null when a field is not stated; do not guess deadlines.",
    content: text.slice(0, 40_000),
    maxTokens: 8000,
  });
  return { externalKey: `manual:${url}`, ...p, url, applyUrl: url };
}

type LdJob = {
  "@type"?: string | string[];
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string } | string;
  jobLocation?: { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } } | { address?: Record<string, string> }[];
  jobLocationType?: string;
  validThrough?: string;
  datePosted?: string;
};

export function jobPostingFromJsonLd(html: string, url: string): NormalizedPosting | null {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(b[1].trim());
    } catch {
      continue;
    }
    const items = (Array.isArray(data) ? data : [data, ...(((data as { "@graph"?: unknown[] })["@graph"]) ?? [])]) as LdJob[];
    const job = items.find((i) => [i?.["@type"]].flat().includes("JobPosting"));
    if (!job?.title) continue;
    const org = typeof job.hiringOrganization === "string" ? job.hiringOrganization : job.hiringOrganization?.name;
    const loc = [job.jobLocation].flat()[0]?.address;
    const location = loc ? [loc.addressLocality, loc.addressRegion, loc.addressCountry].filter(Boolean).join(", ") : null;
    const description = stripHtml(job.description);
    return {
      externalKey: `manual:${url}`,
      type: guessType(job.title),
      title: job.title,
      org: org ?? new URL(url).hostname,
      location,
      remote: job.jobLocationType === "TELECOMMUTE",
      season: guessSeason(`${job.title} ${description.slice(0, 500)}`),
      deadline: job.validThrough?.slice(0, 10) ?? null,
      url,
      applyUrl: url,
      description,
      postedAt: job.datePosted ? new Date(job.datePosted) : null,
    };
  }
  return null;
}
