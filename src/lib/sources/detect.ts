import { getJson } from "./http";
import { parseWorkdayUrl } from "./workday";

export type DetectedAts = { ats: string; boardId: string; openCount: number };

function slugs(name: string): string[] {
  const base = name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim();
  return [...new Set([base.replace(/\s+/g, ""), base.replace(/\s+/g, "-"), base.split(/\s+/)[0]])].filter(Boolean);
}

/** Figure out which public ATS a company uses, from a careers URL or by probing slugs (PLAN.md §5.1). */
export async function detectAts(name: string, careersUrl?: string | null): Promise<DetectedAts | null> {
  if (careersUrl) {
    const fromUrl = boardFromUrl(careersUrl);
    if (fromUrl) return { ...fromUrl, openCount: -1 };
  }
  for (const slug of slugs(name)) {
    const probes: [string, () => Promise<number>][] = [
      ["greenhouse", async () => (await getJson<{ jobs: unknown[] }>(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`)).jobs.length],
      ["lever", async () => (await getJson<unknown[]>(`https://api.lever.co/v0/postings/${slug}?mode=json&limit=200`)).length],
      ["ashby", async () => (await getJson<{ jobs: unknown[] }>(`https://api.ashbyhq.com/posting-api/job-board/${slug}`)).jobs.length],
    ];
    for (const [ats, probe] of probes) {
      try {
        const openCount = await probe();
        if (ats === "lever" && openCount === 0) continue; // Lever returns [] for unknown slugs
        return { ats, boardId: slug, openCount };
      } catch {
        /* not this one */
      }
    }
  }
  return null;
}

export function boardFromUrl(url: string): { ats: string; boardId: string } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const parts = u.pathname.split("/").filter(Boolean);
  if (/(^|\.)greenhouse\.io$/.test(u.hostname)) {
    const board = u.searchParams.get("for") ?? (parts[0] === "embed" ? null : parts[0]);
    return board ? { ats: "greenhouse", boardId: board } : null;
  }
  if (u.hostname === "jobs.lever.co" && parts[0]) return { ats: "lever", boardId: parts[0] };
  if (u.hostname === "jobs.ashbyhq.com" && parts[0]) return { ats: "ashby", boardId: parts[0] };
  if (u.hostname === "jobs.smartrecruiters.com" && parts[0]) return { ats: "smartrecruiters", boardId: parts[0] };
  const wd = parseWorkdayUrl(url);
  if (wd) return { ats: "workday", boardId: wd.boardId };
  return null;
}
