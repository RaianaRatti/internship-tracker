import type { SourceAdapter, NormalizedPosting } from "./types";
import { httpsJson } from "./http";
import { guessSeason, guessType, isStudentRole } from "../core/classify-title";
import { stripHtml } from "../core/text";

// Workday's careers sites call an undocumented JSON API (PLAN.md §5.1). boardId = "tenant/wdN/site".
export function parseWorkdayBoard(boardId: string) {
  const [tenant, wd, site] = boardId.split("/");
  if (!tenant || !wd || !site) throw new Error(`Workday boardId must look like "tenant/wd5/site", got "${boardId}"`);
  return { tenant, wd, site, base: `https://${tenant}.${wd}.myworkdayjobs.com` };
}

/** https://acme.wd5.myworkdayjobs.com/en-US/External/job/... -> { boardId: "acme/wd5/External", jobPath } */
export function parseWorkdayUrl(url: string) {
  const u = new URL(url);
  const m = u.hostname.match(/^([^.]+)\.(wd\d+)\.myworkdayjobs\.com$/);
  if (!m) return null;
  const parts = u.pathname.split("/").filter(Boolean).filter((p) => !/^[a-z]{2}-[A-Z]{2}$/.test(p));
  const site = parts[0];
  const jobIdx = parts.indexOf("job");
  return {
    boardId: `${m[1]}/${m[2]}/${site}`,
    jobPath: jobIdx >= 0 ? "/" + parts.slice(jobIdx).join("/") : null,
  };
}

type WdList = { total: number; jobPostings: { title: string; externalPath: string; locationsText?: string; postedOn?: string }[] };
type WdDetail = {
  jobPostingInfo: { id?: string; title: string; jobDescription?: string; location?: string; externalUrl?: string; startDate?: string; jobReqId?: string };
  hiringOrganization?: { name?: string };
};

export async function fetchWorkdayJob(boardId: string, jobPath: string, org: string): Promise<NormalizedPosting> {
  const { tenant, site, base } = parseWorkdayBoard(boardId);
  const d = await httpsJson<WdDetail>(`${base}/wday/cxs/${tenant}/${site}${jobPath}`);
  const info = d.jobPostingInfo;
  const description = stripHtml(info.jobDescription);
  const url = info.externalUrl ?? `${base}/${site}${jobPath}`;
  return {
    externalKey: `workday:${boardId}:${info.jobReqId ?? jobPath}`,
    type: guessType(info.title),
    title: info.title,
    org: d.hiringOrganization?.name || org,
    location: info.location ?? null,
    remote: /remote/i.test(info.location ?? ""),
    season: guessSeason(`${info.title} ${description.slice(0, 500)}`),
    url,
    applyUrl: url,
    ats: "workday",
    description,
  };
}

export const workday: SourceAdapter = {
  id: "workday",
  label: "Workday career sites",
  scope: "company",
  async fetch({ company }) {
    if (!company) return [];
    const { tenant, site, base } = parseWorkdayBoard(company.boardId);
    const out: NormalizedPosting[] = [];
    for (let offset = 0; offset < 200; offset += 20) {
      const page = await httpsJson<WdList>(`${base}/wday/cxs/${tenant}/${site}/jobs`, {
        method: "POST",
        body: { limit: 20, offset, searchText: "intern", appliedFacets: {} },
      });
      for (const p of page.jobPostings) {
        if (!isStudentRole(p.title)) continue;
        const url = `${base}/${site}${p.externalPath}`;
        out.push({
          externalKey: `workday:${company.boardId}:${p.externalPath}`,
          type: guessType(p.title),
          title: p.title,
          org: company.name,
          location: p.locationsText ?? null,
          remote: /remote/i.test(p.locationsText ?? ""),
          season: guessSeason(p.title),
          url,
          applyUrl: url,
          ats: "workday",
        });
      }
      if (offset + 20 >= page.total) break;
    }
    return out;
  },
};
