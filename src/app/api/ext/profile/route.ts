import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { getProfile } from "@/lib/settings";
import { decrypt } from "@/lib/crypto";
import { guard, preflight } from "@/lib/ext";

export const OPTIONS = preflight;

/** Everything the autofill needs (PLAN.md §4, L2). EEO answers are included only for the local extension. */
export function GET(req: Request) {
  return guard(req, async () => {
    const p = await getProfile();
    const [education, links, resumes, answers] = await Promise.all([
      db.select().from(schema.education).orderBy(asc(schema.education.id)),
      db.select().from(schema.links),
      db.select().from(schema.documents),
      db.select().from(schema.answerBank),
    ]);
    const [first, ...rest] = (p.name ?? "").split(" ");
    const link = (re: RegExp) => links.find((l) => re.test(l.label) || re.test(l.url))?.url ?? null;
    const edu = education[0];
    return {
      firstName: first ?? "",
      lastName: rest.join(" "),
      fullName: p.name,
      pronouns: p.pronouns,
      email: p.email,
      phone: p.phone,
      location: p.location,
      workAuthorization: p.workAuthorization,
      needsSponsorship: p.needsSponsorship,
      graduationDate: p.graduationDate,
      school: edu?.school ?? null,
      degree: edu?.degree ?? null,
      major: edu?.major ?? null,
      gpa: edu?.gpa ?? null,
      linkedin: link(/linkedin/i),
      github: link(/github/i),
      website: link(/portfolio|website|personal|site/i) ?? links.find((l) => !/linkedin|github/i.test(l.url))?.url ?? null,
      defaultResume: resumes.find((r) => r.isDefault) ?? resumes.find((r) => r.kind === "resume") ?? null,
      answers: answers.map((a) => ({ question: a.question, answer: a.answer })),
      eeo: p.eeoEncrypted ? JSON.parse(decrypt(p.eeoEncrypted)) : {},
    };
  });
}
