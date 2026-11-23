import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { similarity } from "../core/text";
import { aiConfigured, generate } from "./client";
import { buildVaultContext } from "./vault";

export type AnswerMatch = { id: number; question: string; answer: string; score: number };

/** Match a form question to the answer bank by meaning (token overlap; PLAN.md §3.2). */
export async function matchAnswer(question: string, min = 0.3): Promise<AnswerMatch | null> {
  const bank = await db.select().from(schema.answerBank);
  let best: AnswerMatch | null = null;
  for (const a of bank) {
    const score = similarity(question, a.question);
    if (score >= min && (!best || score > best.score)) best = { id: a.id, question: a.question, answer: a.answer, score };
  }
  return best;
}

const Adapted = z.object({ answer: z.string() });

/** Fill a short answer from the bank, adapting it to the company when the question is company-specific. */
export async function answerQuestion(question: string, opp?: { title: string; org: string; description?: string | null }) {
  const match = await matchAnswer(question);
  if (match) {
    await db.update(schema.answerBank).set({ lastUsedAt: new Date() }).where(eq(schema.answerBank.id, match.id));
  }
  const companySpecific = /\b(why|this (company|team|role)|our|us)\b/i.test(question);
  if (!aiConfigured() || !opp || (match && !companySpecific)) return { answer: match?.answer ?? "", source: match ? "bank" : "none", matchId: match?.id };

  const vault = await buildVaultContext();
  const { data } = await generate(Adapted, {
    vault: vault.text,
    system:
      "Answer an application question for the student using only vault facts. If a prior answer is provided, adapt it to this company rather than starting over. Keep it as short as the question implies. Never invent facts; use [ADD: ...] placeholders for anything missing.",
    content: `<question>${question}</question>\n<company>${opp.org}</company>\n<role>${opp.title}</role>\n${opp.description ? `<posting>${opp.description.slice(0, 8000)}</posting>` : ""}\n${match ? `<prior_answer>${match.answer}</prior_answer>` : ""}`,
    maxTokens: 4000,
  });
  return { answer: data.answer, source: match ? "bank+adapted" : "generated", matchId: match?.id };
}
