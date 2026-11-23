import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { EmailClass } from "@/db/schema";
import { accessToken, getGoogleAccount } from "./oauth";
import { classifyEmail, CLASS_TO_STATUS, AUTO_APPLY_CONFIDENCE, type Classified } from "./classify";
import { loadCandidates, pickMatch } from "./match";
import { setStatus, trackOpportunity } from "../apps";
import { upsertPostings } from "../sources/run";
import { guessType } from "../core/classify-title";
import { stripHtml } from "../core/text";

// Narrow the inbox to likely recruiting mail before anything is downloaded (PLAN.md §7).
const QUERY =
  "{from:(greenhouse-mail.io OR greenhouse.io OR lever.co OR ashbyhq.com OR myworkday.com OR icims.com OR smartrecruiters.com OR jobvite.com OR hackerrank.com OR codesignal.com OR linkedin.com OR joinhandshake.com OR indeed.com) " +
  'subject:(application OR applying OR interview OR assessment OR offer OR internship OR intern OR "next steps" OR "co-op" OR research)}';

type GmailPart = { mimeType: string; body?: { data?: string }; parts?: GmailPart[]; headers?: { name: string; value: string }[] };
type GmailMessage = { id: string; threadId: string; internalDate: string; snippet: string; payload: GmailPart };

async function gmail<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

function bodyText(part: GmailPart): string {
  const plain = findPart(part, "text/plain");
  if (plain?.body?.data) return Buffer.from(plain.body.data, "base64url").toString("utf8");
  const html = findPart(part, "text/html");
  if (html?.body?.data) return stripHtml(Buffer.from(html.body.data, "base64url").toString("utf8"));
  return "";
}

function findPart(part: GmailPart, mime: string): GmailPart | undefined {
  if (part.mimeType === mime && part.body?.data) return part;
  for (const p of part.parts ?? []) {
    const hit = findPart(p, mime);
    if (hit) return hit;
  }
}

export type SyncResult = { scanned: number; autoUpdated: number; needsReview: number; alerts: number; created: number };

export async function syncGmail(opts: { maxMessages?: number } = {}): Promise<SyncResult> {
  const account = await getGoogleAccount();
  if (!account) throw new Error("Gmail is not connected.");
  const token = await accessToken();
  // First sync looks back a year; afterwards only mail since the last sync (minus a day of overlap).
  const since = account.lastSyncAt ? Math.floor(account.lastSyncAt.getTime() / 1000) - 86400 : null;
  const q = `${QUERY} ${since ? `after:${since}` : "newer_than:365d"}`;

  const ids: string[] = [];
  let pageToken: string | undefined;
  const max = opts.maxMessages ?? 500;
  do {
    const page = await gmail<{ messages?: { id: string }[]; nextPageToken?: string }>(
      `messages?q=${encodeURIComponent(q)}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ""}`,
      token,
    );
    ids.push(...(page.messages ?? []).map((m) => m.id));
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < max);

  const result: SyncResult = { scanned: 0, autoUpdated: 0, needsReview: 0, alerts: 0, created: 0 };
  const candidates = await loadCandidates();

  // Oldest first so status changes replay in the order they happened.
  for (const id of ids.slice(0, max).reverse()) {
    const seen = await db.query.emails.findFirst({ where: eq(schema.emails.gmailId, id) });
    if (seen) continue;
    const msg = await gmail<GmailMessage>(`messages/${id}?format=full`, token);
    const header = (n: string) => msg.payload.headers?.find((h) => h.name.toLowerCase() === n)?.value ?? "";
    const email = { from: header("from"), subject: header("subject"), body: bodyText(msg.payload) };
    const receivedAt = new Date(Number(msg.internalDate));
    result.scanned++;

    const c = await classifyEmail(email);
    const outcome = await applyClassification(c, email, receivedAt, candidates);
    if (outcome.state === "auto") result.autoUpdated++;
    if (outcome.state === "pending") result.needsReview++;
    if (outcome.alert) result.alerts++;
    if (outcome.created) result.created++;

    // Only metadata is stored; the full body is processed above and discarded.
    await db.insert(schema.emails).values({
      gmailId: id,
      threadId: msg.threadId,
      fromAddress: email.from,
      subject: email.subject,
      snippet: msg.snippet,
      receivedAt,
      classification: c.classification,
      confidence: c.confidence,
      extracted: { company: c.company, role: c.role, eventDate: c.eventDate, by: c.by },
      applicationId: outcome.applicationId ?? null,
      reviewState: outcome.state,
    });
  }

  await db.update(schema.oauthTokens).set({ lastSyncAt: new Date() }).where(eq(schema.oauthTokens.provider, "google"));
  return result;
}

type Outcome = { state: "auto" | "pending" | "dismissed"; applicationId?: number; alert?: boolean; created?: boolean };

async function applyClassification(
  c: Classified,
  email: { from: string; subject: string; body: string },
  receivedAt: Date,
  candidates: Awaited<ReturnType<typeof loadCandidates>>,
): Promise<Outcome> {
  if (c.classification === "other") return { state: "dismissed" };

  if (c.classification === "job_alert") {
    if (!c.jobs?.length) return { state: "dismissed", alert: true };
    await upsertPostings(
      c.jobs.map((j) => ({
        externalKey: `email-alert:${j.url ?? `${j.company}:${j.title}`}`,
        type: guessType(j.title),
        title: j.title,
        org: j.company,
        location: j.location,
        url: j.url,
        applyUrl: j.url,
        description: `From job alert: ${email.subject}`,
      })),
      "email-alert",
    );
    return { state: "auto", alert: true };
  }

  const match = pickMatch(candidates, { ...email, company: c.company, role: c.role });
  const status = CLASS_TO_STATUS[c.classification];
  const confident = c.confidence >= AUTO_APPLY_CONFIDENCE;

  if (match && status && confident) {
    await recordEmailOnApp(match.applicationId, c.classification, email.subject, receivedAt, c);
    await setStatus(match.applicationId, status, { origin: "gmail", detail: email.subject, when: receivedAt });
    return { state: "auto", applicationId: match.applicationId };
  }

  // A confirmation for something not tracked yet = an application made outside the app. Log it.
  if (!match && c.classification === "confirmation" && confident && c.company) {
    const [opp] = await db
      .insert(schema.opportunities)
      .values({
        externalKey: `gmail:${c.company}:${c.role ?? email.subject}`,
        type: guessType(c.role ?? email.subject),
        title: c.role ?? "Application",
        org: c.company,
        sourceId: "email-alert",
        description: `Created from confirmation email: ${email.subject}`,
      })
      .onConflictDoNothing()
      .returning();
    if (opp) {
      const app = await trackOpportunity(opp.id, "applied");
      candidates.push({ applicationId: app.id, org: opp.org, title: opp.title });
      await recordEmailOnApp(app.id, c.classification, email.subject, receivedAt, c);
      return { state: "auto", applicationId: app.id, created: true };
    }
  }

  return { state: "pending", applicationId: match?.applicationId };
}

export async function recordEmailOnApp(applicationId: number, cls: EmailClass, subject: string, when: Date, c?: Classified) {
  await db.insert(schema.applicationEvents).values({
    applicationId,
    kind: "email",
    title: `Email: ${cls.replace(/_/g, " ")}`,
    detail: subject,
    origin: "gmail",
    occurredAt: when,
  });
  if (cls === "interview_scheduled" && c?.eventDate) {
    const at = new Date(c.eventDate);
    if (!Number.isNaN(at.getTime())) {
      await db.insert(schema.interviews).values({ applicationId, round: "Scheduled (from email)", scheduledAt: at, notes: subject });
    }
  }
}
