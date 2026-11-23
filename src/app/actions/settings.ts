"use server";

import fs from "node:fs/promises";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { OPPORTUNITY_TYPES, type OpportunityType, type Preferences } from "@/db/schema";
import { getPreferences, setSetting } from "@/lib/settings";
import { rescoreAll } from "@/lib/sources/run";
import { back, num, str } from "./util";

const list = (s: string | null) => (s ?? "").split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

export async function savePreferences(fd: FormData) {
  const prev = await getPreferences();
  const prefs: Preferences = {
    ...prev,
    roles: list(str(fd, "roles")),
    keywords: list(str(fd, "keywords")),
    locations: list(str(fd, "locations")),
    seasons: list(str(fd, "seasons")),
    remoteOk: fd.get("remoteOk") === "on",
    types: fd.getAll("types").map(String).filter((t): t is OpportunityType => OPPORTUNITY_TYPES.includes(t as OpportunityType)),
    minPay: num(fd, "minPay") ?? undefined,
    ghostDays: num(fd, "ghostDays") ?? prev.ghostDays,
    followUpDays: num(fd, "followUpDays") ?? prev.followUpDays,
  };
  await db.update(schema.profile).set({ preferences: prefs }).where(eq(schema.profile.id, 1));
  await rescoreAll();
  back("/settings?tab=goals", "Saved; fit scores updated");
}

export async function regenerateExtensionToken() {
  await setSetting("extension_token", crypto.randomUUID().replace(/-/g, ""));
  revalidatePath("/settings");
}

/** Full account deletion (PLAN.md §11). Requires typing DELETE. */
export async function deleteEverything(fd: FormData) {
  if (str(fd, "confirm") !== "DELETE") back("/settings?tab=data", 'Type "DELETE" to confirm', "err");
  const tables = [
    schema.applicationEvents, schema.applicationAnswers, schema.interviews, schema.offers, schema.contacts, schema.reminders,
    schema.applications, schema.generatedDocs, schema.emails, schema.oauthTokens, schema.opportunities, schema.writingSamples,
    schema.answerBank, schema.documents, schema.recommenders, schema.links, schema.activities, schema.skills, schema.projects,
    schema.experiences, schema.education, schema.profile, schema.settings,
  ];
  for (const t of tables) await db.delete(t);
  const files = await fs.readdir("data/uploads").catch(() => []);
  for (const f of files) if (f !== ".gitkeep") await fs.rm(`data/uploads/${f}`, { force: true });
  back("/", "Everything was deleted");
}
