import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { analyzePosting, cleanRole } from "./posting";
import { composeCoverLetter, rankStories, type Tone } from "./cover-letter";
import { currentEducation, loadVault, vaultEvidence } from "./vault-data";

export type RuleLetterInput = {
  applicationId?: number | null;
  opportunityId?: number | null;
  jobText?: string | null; // pasted posting when not tracked
  company?: string | null;
  role?: string | null;
  storyId?: number | null; // null = best match
  tone: Tone;
  variant: number;
  whyCompany?: string | null;
  previousVersion?: number;
};

/** Compose a rule-based cover letter and save it as a Forge document (no AI involved). */
export async function createRuleLetter(input: RuleLetterInput) {
  let opp: typeof schema.opportunities.$inferSelect | undefined;
  let applicationId = input.applicationId ?? null;
  if (applicationId) {
    const app = await db.query.applications.findFirst({ where: eq(schema.applications.id, applicationId) });
    if (app) opp = await db.query.opportunities.findFirst({ where: eq(schema.opportunities.id, app.opportunityId) });
  } else if (input.opportunityId) {
    opp = await db.query.opportunities.findFirst({ where: eq(schema.opportunities.id, input.opportunityId) });
  }
  const org = opp?.org ?? input.company?.trim();
  const role = opp?.title ?? input.role?.trim();
  if (!org || !role) throw new Error("Pick a tracked quest, or enter the company and role for a pasted posting.");
  const description = opp?.description ?? input.jobText ?? "";

  const stories = await db.select().from(schema.stories);
  if (!stories.length) throw new Error("Write a story first (Spellbook → Stories). The letter opens with it.");
  const story = input.storyId ? stories.find((s) => s.id === input.storyId) : rankStories(stories, `${role} ${description}`)[0].story;
  if (!story) throw new Error("That story no longer exists.");

  const vault = await loadVault();
  const recruiter = applicationId
    ? await db.query.contacts.findFirst({ where: and(eq(schema.contacts.applicationId, applicationId), eq(schema.contacts.role, "recruiter")) })
    : undefined;

  const letter = composeCoverLetter({
    name: vault.profile.name,
    org,
    role,
    contactName: recruiter?.name,
    story,
    posting: analyzePosting(description, vault.skills.map((s) => s.name)),
    evidence: vaultEvidence(vault),
    vaultSkills: vault.skills.map((s) => s.name),
    whyCompany: input.whyCompany,
    education: currentEducation(vault),
    tone: input.tone,
    variant: input.variant,
  });

  const [doc] = await db
    .insert(schema.generatedDocs)
    .values({
      kind: "cover_letter",
      applicationId,
      opportunityId: opp?.id ?? null,
      title: `Cover letter: ${org}, ${cleanRole(role) || role}`,
      inputs: {
        engine: "rules",
        storyId: story.id,
        storyAuto: !input.storyId,
        tone: input.tone,
        variant: input.variant,
        whyCompany: input.whyCompany ?? null,
        company: org,
        role,
        jobText: opp ? null : input.jobText ?? null,
        checks: letter.checks,
      },
      body: letter.body,
      citations: letter.paragraphs.map((p) => ({ sentence: p.text, itemIds: p.citations })),
      gaps: letter.body.match(/\[ADD:[^\]]*\]/g) ?? [],
      unsupported: [],
      model: "rules",
      version: (input.previousVersion ?? 0) + 1,
    })
    .returning();

  if (applicationId) {
    await db.update(schema.applications).set({ coverLetterId: doc.id }).where(eq(schema.applications.id, applicationId));
    await db.insert(schema.applicationEvents).values({ applicationId, kind: "generated", title: "Wrote a cover letter", payload: { docId: doc.id }, origin: "system" });
  }
  return doc;
}

/** Same inputs, next wording variant (or another story). */
export async function rewordRuleLetter(docId: number, overrides: { storyId?: number | null; tone?: Tone } = {}) {
  const doc = await db.query.generatedDocs.findFirst({ where: eq(schema.generatedDocs.id, docId) });
  if (!doc) throw new Error("Document not found");
  const i = (doc.inputs ?? {}) as Record<string, unknown>;
  return createRuleLetter({
    applicationId: doc.applicationId,
    opportunityId: doc.opportunityId,
    jobText: (i.jobText as string) ?? null,
    company: i.company as string,
    role: i.role as string,
    storyId: overrides.storyId !== undefined ? overrides.storyId : (i.storyId as number),
    tone: overrides.tone ?? ((i.tone as Tone) || "warm"),
    variant: overrides.storyId !== undefined ? 0 : Number(i.variant ?? 0) + 1,
    whyCompany: (i.whyCompany as string) ?? null,
    previousVersion: doc.version,
  });
}
