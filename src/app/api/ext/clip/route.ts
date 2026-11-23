import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { guard, preflight } from "@/lib/ext";
import { importFromUrl } from "@/lib/sources/url-import";
import { upsertPostings } from "@/lib/sources/run";
import { trackOpportunity } from "@/lib/apps";
import { dedupeKey } from "@/lib/core/text";

export const OPTIONS = preflight;

/**
 * "Save to Quest Log" clipper (PLAN.md §5.3). The extension sends the text of the page the student
 * is already viewing (LinkedIn, Handshake, anything), so nothing is scraped server-side.
 */
export function POST(req: Request) {
  return guard(req, async () => {
    const { url, text } = (await req.json()) as { url: string; text?: string };
    const posting = await importFromUrl(url, text || undefined);
    const r = await upsertPostings([posting], "manual");
    const oppId =
      r.ids[0] ??
      (await db.query.opportunities.findFirst({ where: eq(schema.opportunities.dedupeKey, dedupeKey(posting.org, posting.title)) }))?.id;
    if (!oppId) throw new Error("Could not save this posting");
    const app = await trackOpportunity(oppId);
    return { applicationId: app.id, title: posting.title, org: posting.org };
  });
}
