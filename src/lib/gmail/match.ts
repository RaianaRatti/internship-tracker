import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { normalizeCompany, similarity } from "../core/text";

export type MatchCandidate = { applicationId: number; org: string; title: string };

/** Match an email to an application: company first, then role title similarity (PLAN.md §7). */
export function pickMatch(
  candidates: MatchCandidate[],
  email: { from: string; subject: string; body: string; company: string | null; role: string | null },
): MatchCandidate | null {
  const hay = normalizeCompany(`${email.from} ${email.subject} ${email.body.slice(0, 2000)}`);
  const company = email.company ? normalizeCompany(email.company) : null;
  let best: { c: MatchCandidate; score: number } | null = null;
  for (const c of candidates) {
    const org = normalizeCompany(c.org);
    if (!org) continue;
    const companyHit = (company && (company === org || company.includes(org) || org.includes(company))) || hay.includes(org);
    if (!companyHit) continue;
    const score = 1 + similarity(`${email.role ?? ""} ${email.subject}`, c.title);
    if (!best || score > best.score) best = { c, score };
  }
  return best?.c ?? null;
}

export async function loadCandidates(): Promise<MatchCandidate[]> {
  const rows = await db
    .select({ applicationId: schema.applications.id, org: schema.opportunities.org, title: schema.opportunities.title })
    .from(schema.applications)
    .innerJoin(schema.opportunities, eq(schema.applications.opportunityId, schema.opportunities.id));
  return rows;
}
