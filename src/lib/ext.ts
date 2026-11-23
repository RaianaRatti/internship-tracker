import { eq, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { checkExtensionAuth, cors } from "./ext-auth";

export async function guard(req: Request, handler: () => Promise<unknown>) {
  if (!(await checkExtensionAuth(req))) return cors(Response.json({ error: "Bad or missing extension token. Copy it from Settings." }, { status: 401 }));
  try {
    return cors(Response.json(await handler()));
  } catch (e) {
    return cors(Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 }));
  }
}

export const preflight = () => cors(new Response(null, { status: 204 }));

/** Find the tracked application for the page the extension is on (posting or apply URL). */
export async function findByUrl(url: string) {
  const clean = url.split("#")[0];
  const variants = [clean, clean.replace(/\/apply\/?$/, ""), clean.replace(/\/application\/?$/, ""), clean.split("?")[0]];
  for (const v of variants) {
    const opps = await db.query.opportunities.findMany({
      where: or(eq(schema.opportunities.url, v), eq(schema.opportunities.applyUrl, v)),
    });
    if (!opps.length) continue;
    // The same posting can exist from two sources; prefer the copy that is already tracked.
    for (const opp of opps) {
      const app = await db.query.applications.findFirst({ where: eq(schema.applications.opportunityId, opp.id) });
      if (app) return { opp, app };
    }
    return { opp: opps[0], app: undefined };
  }
  return null;
}
