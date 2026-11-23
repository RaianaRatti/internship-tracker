import { z } from "zod";
import { inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { extract } from "./client";
import { buildVaultContext } from "./vault";

const Ranked = z.object({
  results: z.array(z.object({ id: z.number(), score: z.number().describe("0-100"), reason: z.string().describe("one short line") })),
});

/** AI re-rank of the top heuristic matches (PLAN.md §3.3). */
export async function rerankOpportunities(ids: number[]) {
  if (!ids.length) return 0;
  const vault = await buildVaultContext();
  const opps = await db.select().from(schema.opportunities).where(inArray(schema.opportunities.id, ids));
  const list = opps
    .map((o) => `<opp id="${o.id}">${o.title} — ${o.org} — ${o.location ?? ""} — ${o.season ?? ""}\n${(o.description ?? "").slice(0, 1200)}</opp>`)
    .join("\n");
  const { results } = await extract(Ranked, {
    system:
      "Score how well each opportunity fits this student (0-100) based on their vault: skills, experience level, interests, eligibility. Give a one-line reason that cites concrete overlap, e.g. 'matches your React + research experience'.",
    content: `${vault.text}\n\n<opportunities>\n${list}\n</opportunities>`,
    maxTokens: 8000,
  });
  for (const r of results) {
    if (!ids.includes(r.id)) continue;
    await db
      .update(schema.opportunities)
      .set({ fitScore: Math.max(0, Math.min(100, r.score)), fitReason: `AI: ${r.reason}` })
      .where(inArray(schema.opportunities.id, [r.id]));
  }
  return results.length;
}
