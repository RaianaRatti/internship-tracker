"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { forgeDocument, refineDocument, DOC_KINDS, type DocKind } from "@/lib/ai/forge";
import { describeAiError } from "@/lib/ai/client";
import { wordCount } from "@/lib/core/text";
import { setStatus } from "@/lib/apps";
import { back, num, str } from "./util";

const isRedirect = (e: unknown) => !!e && typeof e === "object" && "digest" in e;

export async function forgeAction(fd: FormData) {
  const kind = (str(fd, "kind") ?? "cover_letter") as DocKind;
  if (!(kind in DOC_KINDS)) back("/forge", "Unknown document type", "err");
  const applicationId = num(fd, "applicationId");
  let opportunityId = num(fd, "opportunityId");
  if (applicationId && !opportunityId) {
    opportunityId = (await db.query.applications.findFirst({ where: eq(schema.applications.id, applicationId) }))?.opportunityId ?? null;
  }
  let docId: number;
  try {
    const doc = await forgeDocument({
      kind,
      applicationId,
      opportunityId,
      jobText: str(fd, "jobText") ?? undefined,
      prompt: str(fd, "prompt") ?? undefined,
      wordLimit: num(fd, "wordLimit"),
      tone: str(fd, "tone") ?? undefined,
      notes: str(fd, "notes") ?? undefined,
      piContext: str(fd, "piContext") ?? undefined,
    });
    docId = doc.id;
    if (applicationId) await setStatus(applicationId, "preparing", { origin: "system" });
  } catch (e) {
    if (isRedirect(e)) throw e;
    back(`/forge${applicationId ? `?app=${applicationId}` : ""}`, describeAiError(e), "err");
  }
  redirect(`/forge?doc=${docId!}`);
}

export async function refineAction(docId: number, fd: FormData) {
  let next: number;
  try {
    next = (await refineDocument(docId, str(fd, "action") ?? "custom", str(fd, "custom") ?? undefined)).id;
  } catch (e) {
    if (isRedirect(e)) throw e;
    back(`/forge?doc=${docId}`, describeAiError(e), "err");
  }
  redirect(`/forge?doc=${next!}`);
}

export async function saveDocEdits(docId: number, fd: FormData) {
  const body = str(fd, "body") ?? "";
  const doc = await db.query.generatedDocs.findFirst({ where: eq(schema.generatedDocs.id, docId) });
  await db
    .update(schema.generatedDocs)
    .set({ body, title: str(fd, "title") ?? undefined, inputs: { ...(doc?.inputs ?? {}), editedByStudent: true } })
    .where(eq(schema.generatedDocs.id, docId));
  back(`/forge?doc=${docId}`, "Saved your edits");
}

export async function saveDocToLibrary(docId: number) {
  const doc = await db.query.generatedDocs.findFirst({ where: eq(schema.generatedDocs.id, docId) });
  if (!doc) return;
  await db.insert(schema.writingSamples).values({
    title: doc.title,
    prompt: doc.prompt,
    body: doc.body,
    tags: doc.kind.replace(/_/g, "-"),
    wordCount: wordCount(doc.body),
    opportunityId: doc.opportunityId,
  });
  back(`/forge?doc=${docId}`, "Saved to your Spellbook");
}

export async function attachDoc(docId: number, fd: FormData) {
  const applicationId = num(fd, "applicationId");
  if (!applicationId) return;
  const doc = await db.query.generatedDocs.findFirst({ where: eq(schema.generatedDocs.id, docId) });
  await db.update(schema.generatedDocs).set({ applicationId }).where(eq(schema.generatedDocs.id, docId));
  if (doc?.kind === "cover_letter") {
    await db.update(schema.applications).set({ coverLetterId: docId }).where(eq(schema.applications.id, applicationId));
  }
  revalidatePath(`/log/${applicationId}`);
  back(`/forge?doc=${docId}`, "Attached to application");
}

export async function deleteDoc(docId: number) {
  await db.delete(schema.generatedDocs).where(eq(schema.generatedDocs.id, docId));
  redirect("/forge");
}
