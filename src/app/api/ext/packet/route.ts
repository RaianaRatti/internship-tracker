import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { guard, preflight, findByUrl } from "@/lib/ext";

export const OPTIONS = preflight;

/** The application packet for the current page: resume version, cover letter, prepared answers. */
export function GET(req: Request) {
  return guard(req, async () => {
    const url = new URL(req.url).searchParams.get("url") ?? "";
    const hit = await findByUrl(url);
    if (!hit?.app) return { tracked: false, opportunity: hit?.opp ? { id: hit.opp.id, title: hit.opp.title, org: hit.opp.org } : null };
    const { app, opp } = hit;
    const [answers, cover, resume] = await Promise.all([
      db.select().from(schema.applicationAnswers).where(eq(schema.applicationAnswers.applicationId, app.id)),
      app.coverLetterId ? db.query.generatedDocs.findFirst({ where: eq(schema.generatedDocs.id, app.coverLetterId) }) : undefined,
      app.resumeDocumentId ? db.query.documents.findFirst({ where: eq(schema.documents.id, app.resumeDocumentId) }) : undefined,
    ]);
    return {
      tracked: true,
      applicationId: app.id,
      status: app.status,
      opportunity: { id: opp.id, title: opp.title, org: opp.org },
      coverLetter: cover?.body ?? null,
      resume: resume ?? null,
      answers: answers.map((a) => ({ question: a.question, answer: a.answer })),
    };
  });
}
