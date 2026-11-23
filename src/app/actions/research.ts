"use server";

import { redirect } from "next/navigation";
import { trackOpportunity } from "@/lib/apps";
import { upsertPostings } from "@/lib/sources/run";
import { loadCurated } from "@/lib/research/curated";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { back, str } from "./util";

export async function trackCurated(fd: FormData) {
  const name = str(fd, "name");
  const p = loadCurated().find((c) => c.name === name);
  if (!p) back("/research", "Program not found", "err");
  const key = `curated:${p!.name}`;
  await upsertPostings(
    [{ externalKey: key, type: p!.type, title: p!.name, org: p!.org, url: p!.url, applyUrl: p!.url, description: [p!.summary, p!.typical_deadline && `Typical deadline: ${p!.typical_deadline}`].filter(Boolean).join("\n") }],
    "manual",
  );
  const opp = await db.query.opportunities.findFirst({ where: eq(schema.opportunities.externalKey, key) });
  if (!opp) back("/research", "Could not track that program", "err");
  const app = await trackOpportunity(opp!.id);
  redirect(`/log/${app.id}`);
}

/** Save a professor as a research opportunity + contact, then open the Forge to draft a cold email. */
export async function trackResearcher(fd: FormData) {
  const name = str(fd, "name")!;
  const institution = str(fd, "institution")!;
  const topic = str(fd, "topic") ?? "";
  const papers = str(fd, "papers") ?? "";
  const key = `openalex:${str(fd, "openAlexId")}`;
  await upsertPostings(
    [{ externalKey: key, type: "research", title: `Research with ${name}`, org: institution, url: `https://openalex.org/${str(fd, "openAlexId")}`, description: `Topic: ${topic}\nRecent papers:\n${papers}` }],
    "manual",
  );
  const opp = await db.query.opportunities.findFirst({ where: eq(schema.opportunities.externalKey, key) });
  const app = await trackOpportunity(opp!.id);
  const existing = await db.query.contacts.findFirst({ where: eq(schema.contacts.applicationId, app.id) });
  if (!existing) await db.insert(schema.contacts).values({ applicationId: app.id, name, role: "pi", companyName: institution, notes: papers });
  redirect(`/forge?app=${app.id}&kind=cold_email`);
}
