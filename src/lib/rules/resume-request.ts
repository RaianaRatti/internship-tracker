import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { buildResume } from "./resume";
import { loadVault } from "./vault-data";

/** Shared by the Forge preview, the .docx route and the print page: same query params, same resume. */
export async function resumeFromParams(sp: Record<string, string | undefined>) {
  const appId = sp.app ? Number(sp.app) : null;
  const app = appId ? await db.query.applications.findFirst({ where: eq(schema.applications.id, appId) }) : undefined;
  const opp = app ? await db.query.opportunities.findFirst({ where: eq(schema.opportunities.id, app.opportunityId) }) : undefined;
  const vault = await loadVault();
  const doc = buildResume(vault, {
    posting: opp ? { title: opp.title, org: opp.org, description: opp.description } : null,
    maxBullets: sp.bullets ? Number(sp.bullets) : 4,
    maxProjects: sp.projects ? Number(sp.projects) : 3,
    includeActivities: sp.activities !== "0",
  });
  return { doc, app, opp };
}
