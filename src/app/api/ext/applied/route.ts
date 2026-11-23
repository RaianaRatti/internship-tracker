import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { guard, preflight, findByUrl } from "@/lib/ext";
import { setStatus, trackOpportunity } from "@/lib/apps";
import { importFromUrl } from "@/lib/sources/url-import";
import { upsertPostings } from "@/lib/sources/run";

export const OPTIONS = preflight;

/** Called after the student clicks submit on a form the extension filled: log it as Applied (L2). */
export function POST(req: Request) {
  return guard(req, async () => {
    const { url, text, level } = (await req.json()) as { url: string; text?: string; level?: string };
    let hit = await findByUrl(url);
    if (!hit) {
      const posting = await importFromUrl(url, text || undefined);
      const r = await upsertPostings([posting], "manual");
      const opp = await db.query.opportunities.findFirst({ where: eq(schema.opportunities.id, r.ids[0]) });
      hit = opp ? { opp, app: undefined } : null;
    }
    if (!hit) throw new Error("Could not identify this application");
    const app = hit.app ?? (await trackOpportunity(hit.opp.id));
    await setStatus(app.id, "applied", { detail: "Submitted with the Quest Log extension" });
    await db.update(schema.applications).set({ applyLevel: level ?? "L2" }).where(eq(schema.applications.id, app.id));
    return { applicationId: app.id };
  });
}
