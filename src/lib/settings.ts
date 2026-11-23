import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Preferences } from "@/db/schema";
import { DEFAULT_PREFERENCES } from "./settings-defaults";

export { DEFAULT_PREFERENCES };

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, key) });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}

export async function getProfile() {
  let row = await db.query.profile.findFirst();
  if (!row) {
    await db.insert(schema.profile).values({ id: 1, preferences: DEFAULT_PREFERENCES }).onConflictDoNothing();
    row = (await db.query.profile.findFirst())!;
  }
  return row;
}

export async function getPreferences(): Promise<Preferences> {
  const p = await getProfile();
  return { ...DEFAULT_PREFERENCES, ...(p.preferences ?? {}) };
}

/** Shared secret the browser extension sends with every request. */
export async function getExtensionToken(): Promise<string> {
  const existing = await getSetting("extension_token");
  if (existing) return existing;
  const token = crypto.randomBytes(16).toString("hex");
  await setSetting("extension_token", token);
  return token;
}
