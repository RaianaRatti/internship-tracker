"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { STATUSES, OPPORTUNITY_TYPES, type Status, type OpportunityType } from "@/db/schema";
import { setStatus, trackOpportunity } from "@/lib/apps";
import { importFromUrl } from "@/lib/sources/url-import";
import { upsertPostings } from "@/lib/sources/run";
import { guessType } from "@/lib/core/classify-title";
import { dedupeKey } from "@/lib/core/text";
import { answerQuestion } from "@/lib/ai/answers";
import { describeAiError } from "@/lib/ai/client";
import { back, errMsg, num, str } from "./util";

export async function trackAction(opportunityId: number, status: Status = "saved") {
  const app = await trackOpportunity(opportunityId, status);
  revalidatePath("/quests");
  revalidatePath("/log");
  return app.id;
}

export async function trackAndOpen(opportunityId: number) {
  const app = await trackOpportunity(opportunityId);
  redirect(`/log/${app.id}`);
}

export async function hideOpportunity(opportunityId: number) {
  await db.update(schema.opportunities).set({ hidden: true }).where(eq(schema.opportunities.id, opportunityId));
  revalidatePath("/quests");
}

export async function moveCard(applicationId: number, status: Status) {
  if (!STATUSES.includes(status)) return;
  await setStatus(applicationId, status);
  revalidatePath("/log");
  revalidatePath("/");
}

export async function setStatusAction(applicationId: number, fd: FormData) {
  const status = str(fd, "status") as Status;
  if (STATUSES.includes(status)) await setStatus(applicationId, status, { detail: str(fd, "detail") ?? undefined });
  revalidatePath(`/log/${applicationId}`);
}

export async function updateApplication(applicationId: number, fd: FormData) {
  const next = str(fd, "nextActionAt");
  await db
    .update(schema.applications)
    .set({
      notes: str(fd, "notes"),
      resumeDocumentId: num(fd, "resumeDocumentId"),
      coverLetterId: num(fd, "coverLetterId"),
      applyLevel: str(fd, "applyLevel"),
      priority: num(fd, "priority") ?? 0,
      nextActionAt: next ? new Date(`${next}T09:00:00`) : null,
    })
    .where(eq(schema.applications.id, applicationId));
  const app = await db.query.applications.findFirst({ where: eq(schema.applications.id, applicationId) });
  if (app) {
    await db
      .update(schema.opportunities)
      .set({ deadline: str(fd, "deadline"), compensation: str(fd, "compensation") })
      .where(eq(schema.opportunities.id, app.opportunityId));
  }
  back(`/log/${applicationId}`, "Saved");
}

export async function addNote(applicationId: number, fd: FormData) {
  const text = str(fd, "note");
  if (text) {
    await db.insert(schema.applicationEvents).values({ applicationId, kind: "note", title: "Note", detail: text, origin: "user" });
  }
  revalidatePath(`/log/${applicationId}`);
}

export async function addInterview(applicationId: number, fd: FormData) {
  const at = str(fd, "scheduledAt");
  await db.insert(schema.interviews).values({
    applicationId,
    round: str(fd, "round") ?? "Interview",
    scheduledAt: at ? new Date(at) : null,
    format: str(fd, "format"),
    interviewers: str(fd, "interviewers"),
    questions: str(fd, "questions"),
    notes: str(fd, "notes"),
    selfRating: num(fd, "selfRating"),
  });
  await db.insert(schema.applicationEvents).values({ applicationId, kind: "interview", title: `Interview: ${str(fd, "round") ?? ""}`, origin: "user", occurredAt: at ? new Date(at) : new Date() });
  await setStatus(applicationId, "interviewing", { origin: "system" });
  revalidatePath(`/log/${applicationId}`);
}

export async function deleteInterview(applicationId: number, id: number) {
  await db.delete(schema.interviews).where(eq(schema.interviews.id, id));
  revalidatePath(`/log/${applicationId}`);
}

export async function saveOffer(applicationId: number, fd: FormData) {
  const existing = await db.query.offers.findFirst({ where: eq(schema.offers.applicationId, applicationId) });
  const values = {
    applicationId,
    hourly: num(fd, "hourly"),
    monthlyStipend: num(fd, "monthlyStipend"),
    housing: str(fd, "housing"),
    relocation: str(fd, "relocation"),
    other: str(fd, "other"),
    decisionDeadline: str(fd, "decisionDeadline"),
    decision: str(fd, "decision") ?? "pending",
    notes: str(fd, "notes"),
  };
  if (existing) await db.update(schema.offers).set(values).where(eq(schema.offers.id, existing.id));
  else await db.insert(schema.offers).values(values);
  if (values.decision === "accepted") await setStatus(applicationId, "accepted");
  else if (values.decision === "declined") await setStatus(applicationId, "declined");
  else await setStatus(applicationId, "offer", { origin: "system" });
  revalidatePath(`/log/${applicationId}`);
}

export async function addContact(applicationId: number, fd: FormData) {
  const name = str(fd, "name");
  if (!name) return;
  await db.insert(schema.contacts).values({
    applicationId,
    name,
    role: str(fd, "role"),
    email: str(fd, "email"),
    linkedin: str(fd, "linkedin"),
    companyName: str(fd, "companyName"),
    notes: str(fd, "notes"),
  });
  revalidatePath(`/log/${applicationId}`);
}

export async function deleteContact(applicationId: number, id: number) {
  await db.delete(schema.contacts).where(eq(schema.contacts.id, id));
  revalidatePath(`/log/${applicationId}`);
}

export async function addReminder(applicationId: number | null, fd: FormData) {
  const text = str(fd, "text");
  const due = str(fd, "dueAt");
  if (!text) return;
  await db.insert(schema.reminders).values({ applicationId, text, dueAt: due ? new Date(`${due}T09:00:00`) : new Date() });
  revalidatePath(applicationId ? `/log/${applicationId}` : "/");
  revalidatePath("/");
}

export async function completeReminder(id: number) {
  await db.update(schema.reminders).set({ done: true }).where(eq(schema.reminders.id, id));
  revalidatePath("/");
}

/** Application packet answers (L1, PLAN.md §4): fill from the answer bank, adapt with AI. */
export async function addAnswer(applicationId: number, fd: FormData) {
  const question = str(fd, "question");
  if (!question) return;
  const app = await db.query.applications.findFirst({ where: eq(schema.applications.id, applicationId) });
  const opp = app ? await db.query.opportunities.findFirst({ where: eq(schema.opportunities.id, app.opportunityId) }) : undefined;
  try {
    const res = await answerQuestion(question, opp ?? undefined);
    await db.insert(schema.applicationAnswers).values({ applicationId, question, answer: res.answer || "[ADD: your answer]", answerBankId: res.matchId ?? null });
  } catch (e) {
    back(`/log/${applicationId}`, describeAiError(e), "err");
  }
  revalidatePath(`/log/${applicationId}`);
}

export async function updateAnswer(applicationId: number, id: number, fd: FormData) {
  const answer = str(fd, "answer") ?? "";
  await db.update(schema.applicationAnswers).set({ answer }).where(eq(schema.applicationAnswers.id, id));
  if (fd.get("saveToBank")) {
    const row = await db.query.applicationAnswers.findFirst({ where: eq(schema.applicationAnswers.id, id) });
    if (row) await db.insert(schema.answerBank).values({ question: row.question, answer });
  }
  revalidatePath(`/log/${applicationId}`);
}

export async function deleteAnswer(applicationId: number, id: number) {
  await db.delete(schema.applicationAnswers).where(eq(schema.applicationAnswers.id, id));
  revalidatePath(`/log/${applicationId}`);
}

export async function deleteApplication(applicationId: number) {
  for (const t of [schema.applicationEvents, schema.applicationAnswers, schema.interviews, schema.offers, schema.contacts, schema.reminders] as const) {
    await db.delete(t).where(eq(t.applicationId, applicationId));
  }
  await db.delete(schema.applications).where(eq(schema.applications.id, applicationId));
  redirect("/log");
}

/** Manual add (PLAN.md §3.3): paste a URL (parsed) or fill in fields by hand. */
export async function addManual(fd: FormData) {
  const url = str(fd, "url");
  const text = str(fd, "text");
  const status = (str(fd, "status") as Status) ?? "saved";
  let appId: number;
  try {
    let posting;
    if (url && !str(fd, "title")) {
      posting = await importFromUrl(url, text ?? undefined);
    } else {
      const title = str(fd, "title");
      const org = str(fd, "org");
      if (!title || !org) back("/add", "Give it a title and organization, or paste a URL.", "err");
      const type = (str(fd, "type") as OpportunityType) ?? guessType(title!);
      posting = {
        externalKey: `manual:${url ?? `${org}:${title}:${Date.now()}`}`,
        type: OPPORTUNITY_TYPES.includes(type) ? type : "other",
        title: title!,
        org: org!,
        location: str(fd, "location"),
        deadline: str(fd, "deadline"),
        url,
        applyUrl: url,
        description: text,
      };
    }
    const deadline = str(fd, "deadline");
    if (deadline) posting.deadline = deadline;
    const r = await upsertPostings([posting], "manual");
    const oppId =
      r.ids[0] ??
      // Already known from another source: track that copy instead of a duplicate.
      (await db.query.opportunities.findFirst({ where: eq(schema.opportunities.dedupeKey, dedupeKey(posting.org, posting.title)) }))?.id;
    if (!oppId) back("/add", "Could not save that opportunity.", "err");
    appId = (await trackOpportunity(oppId!, status)).id;
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // let redirects through
    back("/add", errMsg(e), "err");
  }
  redirect(`/log/${appId!}`);
}
