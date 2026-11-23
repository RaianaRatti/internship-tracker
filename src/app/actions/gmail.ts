"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { EMAIL_CLASSES, type EmailClass } from "@/db/schema";
import { syncGmail, recordEmailOnApp } from "@/lib/gmail/sync";
import { disconnectGmail } from "@/lib/gmail/oauth";
import { CLASS_TO_STATUS } from "@/lib/gmail/classify";
import { setStatus } from "@/lib/apps";
import { back, errMsg, num, str } from "./util";

export async function syncGmailAction() {
  try {
    const r = await syncGmail();
    back("/messenger", `Scanned ${r.scanned} emails · ${r.autoUpdated} auto-updated · ${r.needsReview} to review · ${r.alerts} job alerts · ${r.created} new applications found`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    back("/messenger", errMsg(e), "err");
  }
}

/** Review Inbox: one-click confirm or fix a low-confidence email (PLAN.md §7). */
export async function confirmEmail(emailId: number, fd: FormData) {
  const applicationId = num(fd, "applicationId");
  const cls = str(fd, "classification") as EmailClass;
  const email = await db.query.emails.findFirst({ where: eq(schema.emails.id, emailId) });
  if (!email || !EMAIL_CLASSES.includes(cls)) return;
  if (applicationId) {
    await recordEmailOnApp(applicationId, cls, email.subject, email.receivedAt);
    const status = CLASS_TO_STATUS[cls];
    // The student confirmed it, so this counts as a manual change.
    if (status) await setStatus(applicationId, status, { detail: email.subject, when: email.receivedAt });
  }
  await db
    .update(schema.emails)
    .set({ reviewState: "confirmed", classification: cls, applicationId })
    .where(eq(schema.emails.id, emailId));
  revalidatePath("/messenger");
}

export async function dismissEmail(emailId: number) {
  await db.update(schema.emails).set({ reviewState: "dismissed" }).where(eq(schema.emails.id, emailId));
  revalidatePath("/messenger");
}

export async function disconnectGmailAction() {
  await disconnectGmail();
  back("/messenger", "Gmail disconnected; tokens and stored email data deleted");
}
