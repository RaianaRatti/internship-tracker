import { db, schema } from "@/db";

// One-click export of everything as JSON (PLAN.md §11). Tokens and encrypted fields are omitted.
export async function GET() {
  const tables = {
    profile: schema.profile, education: schema.education, experiences: schema.experiences, projects: schema.projects,
    skills: schema.skills, activities: schema.activities, links: schema.links, documents: schema.documents,
    recommenders: schema.recommenders, writingSamples: schema.writingSamples, answerBank: schema.answerBank,
    companies: schema.companies, opportunities: schema.opportunities, applications: schema.applications,
    applicationEvents: schema.applicationEvents, generatedDocs: schema.generatedDocs, applicationAnswers: schema.applicationAnswers,
    contacts: schema.contacts, interviews: schema.interviews, offers: schema.offers, reminders: schema.reminders, emails: schema.emails,
  };
  const out: Record<string, unknown[]> = {};
  for (const [k, t] of Object.entries(tables)) out[k] = await db.select().from(t);
  out.profile = (out.profile as Record<string, unknown>[]).map(({ eeoEncrypted: _omit, ...rest }) => rest);
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), ...out }, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="quest-log-export-${new Date().toISOString().slice(0, 10)}.json"` },
  });
}
