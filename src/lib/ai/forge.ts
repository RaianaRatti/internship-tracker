import { z } from "zod";
import { db, schema } from "@/db";
import { similarity } from "../core/text";
import { getProfile } from "../settings";
import { buildVaultContext } from "./vault";
import { extract, generate, FAST_MODEL } from "./client";
import type { Citation } from "@/db/schema";

export const DOC_KINDS = {
  cover_letter: "Cover letter",
  essay: "Essay / statement",
  short_answer: "Short answer",
  cold_email: "Cold email (research)",
  follow_up: "Follow-up email",
  thank_you: "Thank-you email",
} as const;
export type DocKind = keyof typeof DOC_KINDS;

const RULES = `You write application materials for a student, using ONLY facts in <student_vault>.
Hard rules:
- Never invent experience, employers, numbers, awards, skills, dates or outcomes. If the vault lacks something the task needs, write a placeholder like [ADD: one sentence on why you care about this team] and list it in "gaps".
- Every paragraph lists the vault ids it relies on in "citations" (e.g. "exp-2.b1", "proj-4"). A paragraph with no factual claims about the student may have an empty list.
- Match the student's voice (see <voice> if present): their sentence length, tone and word choices. Avoid clichés ("I am writing to express my interest", "passionate", "synergy").
- Be specific: connect concrete vault evidence to concrete needs of the role or lab.
- Respect any word limit strictly.`;

const Draft = z.object({
  title: z.string().describe("Short title for this document, e.g. 'Cover letter — Stripe SWE Intern'"),
  paragraphs: z.array(z.object({ text: z.string(), citations: z.array(z.string()) })),
  gaps: z.array(z.string()).describe("Things the student must add because the vault does not cover them"),
});

const Requirements = z.object({
  company: z.string(),
  role: z.string(),
  requirements: z.array(z.string()),
  values: z.array(z.string()),
  keywords: z.array(z.string()),
});

export type ForgeInput = {
  kind: DocKind;
  opportunityId?: number | null;
  applicationId?: number | null;
  jobText?: string;
  prompt?: string; // essay question / short-answer question
  wordLimit?: number | null;
  tone?: string;
  notes?: string; // anything extra the student wants included
  piContext?: string; // for cold emails: professor + recent papers
};

export async function forgeDocument(input: ForgeInput) {
  const vault = await buildVaultContext();
  const profile = await getProfile();

  let opp: typeof schema.opportunities.$inferSelect | undefined;
  if (input.opportunityId) {
    opp = await db.query.opportunities.findFirst({ where: (o, { eq }) => eq(o.id, input.opportunityId!) });
  }
  const jobText = input.jobText || (opp ? `${opp.title} at ${opp.org}\n${opp.location ?? ""}\n\n${opp.description ?? ""}` : "");

  // 1. Extract what the role/lab is asking for.
  const reqs = jobText.trim()
    ? await extract(Requirements, {
        system: "Extract the hiring requirements, team/company values, and important keywords from this posting. Be concise.",
        content: jobText.slice(0, 30_000),
      })
    : null;

  // 2. Retrieve the closest writing samples for voice and reusable material.
  const samples = await db.select().from(schema.writingSamples);
  const query = `${input.prompt ?? ""} ${input.kind} ${reqs?.requirements.join(" ") ?? ""}`;
  const topSamples = samples
    .map((s) => ({ s, score: similarity(query, `${s.title} ${s.prompt ?? ""} ${s.tags ?? ""} ${s.body.slice(0, 1500)}`) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ s }) => s);

  // 3. Draft with citations.
  const parts = [
    `<task>${DOC_KINDS[input.kind]}</task>`,
    input.prompt && `<prompt>${input.prompt}</prompt>`,
    input.wordLimit && `<word_limit>${input.wordLimit}</word_limit>`,
    `<tone>${input.tone || (opp?.type === "research" || input.kind === "cold_email" ? "formal, curious, concise" : "warm, direct, specific")}</tone>`,
    reqs && `<role_analysis>${JSON.stringify(reqs)}</role_analysis>`,
    jobText && `<posting>${jobText.slice(0, 20_000)}</posting>`,
    input.piContext && `<professor>${input.piContext}</professor>`,
    profile.voiceProfile && `<voice>${profile.voiceProfile}</voice>`,
    topSamples.length && `<writing_samples>\n${topSamples.map((s) => `<sample title="${s.title}">${s.body.slice(0, 4000)}</sample>`).join("\n")}\n</writing_samples>`,
    input.notes && `<student_notes>${input.notes}</student_notes>`,
  ].filter(Boolean);
  const { data: draft, model } = await generate(Draft, { vault: vault.text, system: RULES, content: parts.join("\n\n") });

  // 4. Check: flag sentences whose claims don't trace to the vault.
  const unsupported = await checkClaims(vault.text, draft.paragraphs.map((p) => p.text));
  const citations: Citation[] = draft.paragraphs.map((p) => ({
    sentence: p.text,
    itemIds: p.citations.filter((id) => vault.ids.has(id)),
  }));

  const [doc] = await db
    .insert(schema.generatedDocs)
    .values({
      kind: input.kind,
      applicationId: input.applicationId ?? null,
      opportunityId: input.opportunityId ?? null,
      title: draft.title,
      prompt: input.prompt ?? null,
      inputs: { ...input, jobText: undefined, requirements: reqs, sampleIds: topSamples.map((s) => s.id) },
      body: draft.paragraphs.map((p) => p.text).join("\n\n"),
      citations,
      gaps: draft.gaps,
      unsupported,
      model,
    })
    .returning();

  if (input.applicationId) {
    await db.insert(schema.applicationEvents).values({
      applicationId: input.applicationId,
      kind: "generated",
      title: `Generated ${DOC_KINDS[input.kind].toLowerCase()}`,
      payload: { docId: doc.id },
      origin: "system",
    });
  }
  return doc;
}

const Check = z.object({
  unsupported: z.array(z.string()).describe("Exact sentences that state facts about the student not supported by the vault"),
});

export async function checkClaims(vaultText: string, paragraphs: string[]): Promise<string[]> {
  const res = await extract(Check, {
    system:
      "You are a strict fact checker. Given a student's vault and a draft, list every sentence that states a fact about the student (experience, skill, number, award, outcome) that the vault does not support. Opinions, enthusiasm, and statements about the company are fine. Placeholders like [ADD: ...] are fine.",
    content: `${vaultText}\n\n<draft>\n${paragraphs.join("\n\n")}\n</draft>`,
  });
  return res.unsupported;
}

const REFINE: Record<string, string> = {
  shorter: "Make it about 30% shorter without losing the strongest evidence.",
  specific: "Make it more specific: replace general statements with concrete vault evidence and concrete details from the posting.",
  voice: "Rewrite so it sounds more like the student's own writing samples and voice.",
};

export async function refineDocument(docId: number, action: string, custom?: string) {
  const doc = await db.query.generatedDocs.findFirst({ where: (d, { eq }) => eq(d.id, docId) });
  if (!doc) throw new Error("Document not found");
  const vault = await buildVaultContext();
  const profile = await getProfile();
  const instruction = REFINE[action] ?? custom ?? "Improve it.";
  const { data, model } = await generate(Draft, {
    vault: vault.text,
    system: RULES,
    content: [
      `<task>Revise this ${DOC_KINDS[doc.kind as DocKind] ?? doc.kind}.</task>`,
      `<instruction>${instruction}</instruction>`,
      doc.prompt && `<prompt>${doc.prompt}</prompt>`,
      profile.voiceProfile && `<voice>${profile.voiceProfile}</voice>`,
      `<current_draft>${doc.body}</current_draft>`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
  const unsupported = await checkClaims(vault.text, data.paragraphs.map((p) => p.text));
  const [next] = await db
    .insert(schema.generatedDocs)
    .values({
      ...doc,
      id: undefined,
      createdAt: undefined,
      body: data.paragraphs.map((p) => p.text).join("\n\n"),
      citations: data.paragraphs.map((p) => ({ sentence: p.text, itemIds: p.citations.filter((id) => vault.ids.has(id)) })),
      gaps: data.gaps,
      unsupported,
      model,
      version: doc.version + 1,
      inputs: { ...(doc.inputs ?? {}), refinedFrom: doc.id, instruction },
    })
    .returning();
  return next;
}

const Voice = z.object({ voice: z.string().describe("A compact style guide, 5-8 bullet lines") });

export async function buildVoiceProfile() {
  const samples = await db.select().from(schema.writingSamples);
  if (!samples.length) throw new Error("Add at least one writing sample first.");
  const { voice } = await extract(Voice, {
    system:
      "Describe this student's writing voice as a compact style guide another writer could follow: typical sentence length, tone, structure habits, words/phrases they use, things they avoid. Do not quote personal facts.",
    content: samples.map((s) => `<sample>${s.body.slice(0, 5000)}</sample>`).join("\n"),
  });
  await db.update(schema.profile).set({ voiceProfile: voice });
  return voice;
}

export { FAST_MODEL };
