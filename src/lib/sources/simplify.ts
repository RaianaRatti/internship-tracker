import type { SourceAdapter, NormalizedPosting } from "./types";
import { getJson } from "./http";
import { guessType } from "../core/classify-title";

// Community-maintained internship lists (PLAN.md §5.4). Each repo publishes a machine-readable listings.json.
type Listing = {
  id: string;
  company_name: string;
  title: string;
  url: string;
  locations: string[];
  terms?: string[];
  season?: string;
  active: boolean;
  is_visible: boolean;
  date_posted: number;
  sponsorship?: string;
  category?: string;
};

export const DEFAULT_REPOS = ["SimplifyJobs/Summer2027-Internships", "SimplifyJobs/New-Grad-Positions"];

export function normalizeListing(l: Listing, repo: string): NormalizedPosting {
  const term = l.terms?.[0] ?? l.season ?? null;
  const isNewGrad = repo.includes("New-Grad");
  const location = l.locations.join("; ");
  return {
    externalKey: `simplify:${l.id}`,
    type: isNewGrad ? "new_grad" : guessType(l.title, "internship"),
    title: l.title,
    org: l.company_name,
    location,
    remote: /remote/i.test(location),
    season: term,
    url: l.url,
    applyUrl: l.url,
    ats: atsFromUrl(l.url),
    description: [l.category && `Category: ${l.category}`, l.sponsorship && `Sponsorship: ${l.sponsorship}`]
      .filter(Boolean)
      .join("\n"),
    postedAt: new Date(l.date_posted * 1000),
    active: l.active,
  };
}

export function atsFromUrl(url: string): string | null {
  if (/greenhouse\.io|gh_jid=/.test(url)) return "greenhouse";
  if (/lever\.co/.test(url)) return "lever";
  if (/ashbyhq\.com/.test(url)) return "ashby";
  if (/myworkdayjobs\.com/.test(url)) return "workday";
  if (/smartrecruiters\.com/.test(url)) return "smartrecruiters";
  if (/icims\.com/.test(url)) return "icims";
  return null;
}

export const simplify: SourceAdapter = {
  id: "simplify",
  label: "SimplifyJobs GitHub lists",
  scope: "global",
  async fetch() {
    const out: NormalizedPosting[] = [];
    for (const repo of DEFAULT_REPOS) {
      const listings = await getJson<Listing[]>(
        `https://raw.githubusercontent.com/${repo}/dev/.github/scripts/listings.json`,
        { timeoutMs: 60_000 },
      );
      // Inactive listings are kept so we can mark tracked ones as closed.
      const recent = Date.now() / 1000 - 365 * 86400;
      out.push(...listings.filter((l) => l.is_visible && (l.active || l.date_posted > recent)).map((l) => normalizeListing(l, repo)));
    }
    return out;
  },
};
