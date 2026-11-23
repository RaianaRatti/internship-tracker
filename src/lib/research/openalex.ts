import { getJson } from "../sources/http";

// Faculty finder (PLAN.md §5.5): find active researchers at a school working on a topic, with recent papers.
const BASE = "https://api.openalex.org";

function withAuth(url: string) {
  const u = new URL(url);
  if (process.env.OPENALEX_API_KEY) u.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
  if (process.env.CRAWLER_CONTACT) u.searchParams.set("mailto", process.env.CRAWLER_CONTACT);
  return u.toString();
}

export type Institution = { id: string; name: string; country: string | null };

export async function searchInstitutions(q: string): Promise<Institution[]> {
  const d = await getJson<{ results: { id: string; display_name: string; country_code: string | null }[] }>(
    withAuth(`${BASE}/institutions?search=${encodeURIComponent(q)}&per_page=5&select=id,display_name,country_code`),
  );
  return d.results.map((r) => ({ id: r.id.replace("https://openalex.org/", ""), name: r.display_name, country: r.country_code }));
}

type Work = {
  id: string;
  title: string;
  publication_year: number;
  cited_by_count: number;
  doi: string | null;
  authorships: {
    author_position: "first" | "middle" | "last";
    author: { id: string | null; display_name: string };
    institutions: { id: string }[];
  }[];
};

export type Researcher = {
  openAlexId: string;
  name: string;
  score: number;
  lastAuthorCount: number;
  papers: { title: string; year: number; url: string | null; citations: number }[];
};

/**
 * Researchers at `institutionId` publishing on `topic` since `sinceYear`. Last authorship is weighted
 * higher since in most STEM fields the last author is the PI running the lab.
 */
export async function findResearchers(topic: string, institutionId: string, sinceYear = new Date().getFullYear() - 3): Promise<Researcher[]> {
  const filter = [
    `authorships.institutions.id:${institutionId}`,
    `from_publication_date:${sinceYear}-01-01`,
    `title_and_abstract.search:${topic.replace(/[,:]/g, " ")}`,
  ].join(",");
  const d = await getJson<{ results: Work[] }>(
    withAuth(`${BASE}/works?filter=${encodeURIComponent(filter)}&sort=cited_by_count:desc&per_page=100&select=id,title,publication_year,cited_by_count,doi,authorships`),
  );
  const instUrl = `https://openalex.org/${institutionId}`;
  const byAuthor = new Map<string, Researcher>();
  for (const w of d.results) {
    for (const a of w.authorships) {
      if (!a.author?.id || !a.institutions.some((i) => i.id === instUrl)) continue;
      const authorId = a.author.id;
      const r = byAuthor.get(authorId) ?? {
        openAlexId: authorId.replace("https://openalex.org/", ""),
        name: a.author.display_name,
        score: 0,
        lastAuthorCount: 0,
        papers: [],
      };
      const isLast = a.author_position === "last";
      r.score += isLast ? 3 : 1;
      if (isLast) r.lastAuthorCount++;
      if (r.papers.length < 5) r.papers.push({ title: w.title, year: w.publication_year, url: w.doi ?? w.id, citations: w.cited_by_count });
      byAuthor.set(authorId, r);
    }
  }
  return [...byAuthor.values()].sort((a, b) => b.score - a.score).slice(0, 20);
}
