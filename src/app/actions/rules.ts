"use server";

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createRuleLetter, rewordRuleLetter } from "@/lib/rules/letter-service";
import { resumeFromParams } from "@/lib/rules/resume-request";
import { resumeToDocx } from "@/lib/rules/resume";
import { setStatus } from "@/lib/apps";
import type { Tone } from "@/lib/rules/cover-letter";
import { back, errMsg, num, str } from "./util";

const isRedirect = (e: unknown) => !!e && typeof e === "object" && "digest" in e;

export async function createLetterAction(fd: FormData) {
  const applicationId = num(fd, "applicationId");
  let docId: number;
  try {
    const doc = await createRuleLetter({
      applicationId,
      jobText: str(fd, "jobText"),
      company: str(fd, "company"),
      role: str(fd, "role"),
      storyId: num(fd, "storyId"),
      tone: (str(fd, "tone") as Tone) ?? "warm",
      variant: 0,
      whyCompany: str(fd, "whyCompany"),
    });
    docId = doc.id;
    if (applicationId) await setStatus(applicationId, "preparing", { origin: "system" });
  } catch (e) {
    if (isRedirect(e)) throw e;
    back(`/forge${applicationId ? `?app=${applicationId}` : ""}`, errMsg(e), "err");
  }
  redirect(`/forge?doc=${docId!}`);
}

export async function rewordAction(docId: number, fd: FormData) {
  const storyRaw = str(fd, "storyId");
  let next: number;
  try {
    next = (
      await rewordRuleLetter(docId, {
        storyId: storyRaw === null ? undefined : storyRaw === "auto" ? null : Number(storyRaw),
        tone: (str(fd, "tone") as Tone) ?? undefined,
      })
    ).id;
  } catch (e) {
    if (isRedirect(e)) throw e;
    back(`/forge?doc=${docId}`, errMsg(e), "err");
  }
  redirect(`/forge?doc=${next!}`);
}

/** Save the generated resume as a document version (used by the packet, autofill and resume A/B stats). */
export async function saveResumeVersion(fd: FormData) {
  const sp = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
  const { doc, app, opp } = await resumeFromParams(sp);
  const buf = await resumeToDocx(doc);
  const storagePath = path.join("data", "uploads", `${crypto.randomUUID()}.docx`);
  await fs.writeFile(storagePath, buf);
  const label = opp ? `Resume: tailored for ${opp.org}` : `Resume: general (${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })})`;
  const hasDefault = await db.query.documents.findFirst({ where: eq(schema.documents.isDefault, true) });
  const [row] = await db
    .insert(schema.documents)
    .values({
      kind: "resume",
      label,
      filename: `${doc.name.replace(/[^\w ]+/g, "")} Resume.docx`,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storagePath,
      isDefault: !hasDefault,
    })
    .returning();
  if (app) {
    await db.update(schema.applications).set({ resumeDocumentId: row.id }).where(eq(schema.applications.id, app.id));
    back(`/log/${app.id}`, `Saved "${label}" and attached it to this quest`);
  }
  back("/vault?tab=documents", `Saved "${label}"`);
}
