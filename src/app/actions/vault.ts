"use server";

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { SECTIONS, type SectionKey } from "@/lib/vault-sections";
import { encrypt } from "@/lib/crypto";
import { getProfile, setSetting, getSetting } from "@/lib/settings";
import { parseResume, type ResumeImportData } from "@/lib/ai/resume";
import { describeAiError } from "@/lib/ai/client";
import { rescoreAll } from "@/lib/sources/run";
import { back, str } from "./util";

export async function saveProfile(fd: FormData) {
  await getProfile();
  await db
    .update(schema.profile)
    .set({
      name: str(fd, "name") ?? "",
      pronouns: str(fd, "pronouns"),
      email: str(fd, "email"),
      phone: str(fd, "phone"),
      location: str(fd, "location"),
      workAuthorization: str(fd, "workAuthorization"),
      needsSponsorship: fd.get("needsSponsorship") === "on",
      willingToRelocate: fd.get("willingToRelocate") === "on",
      graduationDate: str(fd, "graduationDate"),
      classYear: str(fd, "classYear"),
      headline: str(fd, "headline"),
      summary: str(fd, "summary"),
      updatedAt: new Date(),
    })
    .where(eq(schema.profile.id, 1));
  back("/vault", "Character sheet saved");
}

export async function saveEeo(fd: FormData) {
  const data = Object.fromEntries([...fd.entries()].filter(([k]) => k.startsWith("eeo_")).map(([k, v]) => [k.slice(4), String(v)]));
  await db.update(schema.profile).set({ eeoEncrypted: encrypt(JSON.stringify(data)) }).where(eq(schema.profile.id, 1));
  back("/vault?tab=eeo", "Saved (encrypted, never sent to AI)");
}

export async function saveSectionItem(section: SectionKey, id: number | null, fd: FormData) {
  const def = SECTIONS[section];
  const values: Record<string, unknown> = {};
  for (const f of def.fields) values[f.name] = str(fd, f.name);
  const required = def.fields.find((f) => f.required && !values[f.name]);
  if (required) back(`/vault?tab=${section}`, `${required.label} is required`, "err");
  if (id) await db.update(def.table).set(values).where(eq(def.table.id, id));
  else await db.insert(def.table).values(values as never);
  if (section === "skills") await rescoreAll();
  revalidatePath("/vault");
}

export async function deleteSectionItem(section: SectionKey, id: number) {
  const def = SECTIONS[section];
  await db.delete(def.table).where(eq(def.table.id, id));
  revalidatePath("/vault");
}

export async function uploadDocument(fd: FormData) {
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) back("/vault?tab=documents", "Choose a file", "err");
  const f = file as File;
  const ext = path.extname(f.name).slice(0, 10);
  const storagePath = path.join("data", "uploads", `${crypto.randomUUID()}${ext}`);
  await fs.writeFile(storagePath, Buffer.from(await f.arrayBuffer()));
  const kind = str(fd, "kind") ?? "resume";
  const existingDefault = await db.query.documents.findFirst({ where: eq(schema.documents.isDefault, true) });
  await db.insert(schema.documents).values({
    kind,
    label: str(fd, "label") ?? f.name,
    filename: f.name,
    mime: f.type || "application/octet-stream",
    storagePath,
    isDefault: kind === "resume" && !existingDefault,
  });
  back("/vault?tab=documents", `Uploaded ${f.name}`);
}

export async function setDefaultResume(id: number) {
  await db.update(schema.documents).set({ isDefault: false });
  await db.update(schema.documents).set({ isDefault: true }).where(eq(schema.documents.id, id));
  revalidatePath("/vault");
}

export async function deleteDocument(id: number) {
  const doc = await db.query.documents.findFirst({ where: eq(schema.documents.id, id) });
  if (doc) await fs.rm(doc.storagePath, { force: true });
  await db.delete(schema.documents).where(eq(schema.documents.id, id));
  revalidatePath("/vault");
}

/** Resume import: AI parses, the student confirms each item before it lands in the vault (PLAN.md §3.1). */
export async function importResume(fd: FormData) {
  const file = fd.get("file");
  const text = str(fd, "text");
  try {
    let parsed: ResumeImportData;
    if (file instanceof File && file.size) {
      if (file.type !== "application/pdf") back("/vault?tab=import", "Upload a PDF, or paste the resume text", "err");
      parsed = await parseResume({ pdfBase64: Buffer.from(await file.arrayBuffer()).toString("base64") });
    } else if (text) parsed = await parseResume({ text });
    else back("/vault?tab=import", "Upload a PDF or paste text", "err");
    await setSetting("resume_import_draft", JSON.stringify(parsed!));
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    back("/vault?tab=import", describeAiError(e), "err");
  }
  back("/vault?tab=import", "Parsed! Review each item below, then confirm.");
}

export async function confirmImport(fd: FormData) {
  const raw = await getSetting("resume_import_draft");
  if (!raw) back("/vault?tab=import", "Nothing to import", "err");
  const d = JSON.parse(raw!) as ResumeImportData;
  const on = (k: string) => fd.get(k) === "on";
  if (on("profile")) {
    await getProfile();
    const p = d.profile;
    await db
      .update(schema.profile)
      .set({ name: p.name, email: p.email, phone: p.phone, location: p.location, headline: p.headline })
      .where(eq(schema.profile.id, 1));
  }
  const pick = <T,>(arr: T[], key: string) => arr.filter((_, i) => on(`${key}-${i}`));
  const edu = pick(d.education, "education");
  if (edu.length) await db.insert(schema.education).values(edu);
  const exp = pick(d.experiences, "experiences");
  if (exp.length) await db.insert(schema.experiences).values(exp.map((e) => ({ ...e, bullets: e.bullets.join("\n") })));
  const proj = pick(d.projects, "projects");
  if (proj.length) await db.insert(schema.projects).values(proj);
  const sk = pick(d.skills, "skills");
  if (sk.length) await db.insert(schema.skills).values(sk);
  const act = pick(d.activities, "activities");
  if (act.length) await db.insert(schema.activities).values(act);
  const lnk = pick(d.links, "links");
  if (lnk.length) await db.insert(schema.links).values(lnk);
  await db.delete(schema.settings).where(eq(schema.settings.key, "resume_import_draft"));
  await rescoreAll();
  back("/vault", "Imported into your Character Sheet");
}

export async function discardImport() {
  await db.delete(schema.settings).where(eq(schema.settings.key, "resume_import_draft"));
  revalidatePath("/vault");
}
