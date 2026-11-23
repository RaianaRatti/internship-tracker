import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

const id = () => integer("id").primaryKey({ autoIncrement: true });
const createdAt = () =>
  integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`);
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`);
const ts = (name: string) => integer(name, { mode: "timestamp" });
const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

export type Preferences = {
  roles: string[];
  keywords: string[];
  locations: string[];
  remoteOk: boolean;
  seasons: string[];
  types: OpportunityType[];
  minPay?: number;
  ghostDays: number;
  followUpDays: number;
};

export const OPPORTUNITY_TYPES = [
  "internship",
  "coop",
  "early_program",
  "research",
  "fellowship",
  "scholarship",
  "event",
  "new_grad",
  "other",
] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const STATUSES = [
  "saved",
  "preparing",
  "applied",
  "assessment",
  "interviewing",
  "offer",
  "accepted",
  "declined",
  "rejected",
  "withdrawn",
  "ghosted",
] as const;
export type Status = (typeof STATUSES)[number];

// ---------- Profile vault (Character Sheet) ----------

export const profile = sqliteTable("profile", {
  id: integer("id").primaryKey(), // always 1: single-user, local-first
  name: text("name").notNull().default(""),
  pronouns: text("pronouns"),
  email: text("email"),
  phone: text("phone"),
  location: text("location"),
  workAuthorization: text("work_authorization"),
  needsSponsorship: integer("needs_sponsorship", { mode: "boolean" }).default(false),
  willingToRelocate: integer("willing_to_relocate", { mode: "boolean" }).default(true),
  graduationDate: text("graduation_date"),
  classYear: text("class_year"),
  headline: text("headline"),
  summary: text("summary"),
  voiceProfile: text("voice_profile"),
  preferences: json<Preferences>("preferences"),
  eeoEncrypted: text("eeo_encrypted"),
  updatedAt: updatedAt(),
});

export const education = sqliteTable("education", {
  id: id(),
  school: text("school").notNull(),
  degree: text("degree"),
  major: text("major"),
  minor: text("minor"),
  gpa: text("gpa"),
  start: text("start"),
  end: text("end"),
  coursework: text("coursework"),
  honors: text("honors"),
  createdAt: createdAt(),
});

export const experiences = sqliteTable("experiences", {
  id: id(),
  kind: text("kind").notNull().default("job"), // job | internship | research | ta | volunteer
  org: text("org").notNull(),
  role: text("role").notNull(),
  location: text("location"),
  start: text("start"),
  end: text("end"),
  bullets: text("bullets"), // one bullet per line; each line is citable
  skills: text("skills"),
  createdAt: createdAt(),
});

export const projects = sqliteTable("projects", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  tech: text("tech"),
  url: text("url"),
  impact: text("impact"),
  start: text("start"),
  end: text("end"),
  createdAt: createdAt(),
});

export const skills = sqliteTable("skills", {
  id: id(),
  name: text("name").notNull(),
  category: text("category"), // language | framework | tool | spoken | other
  level: text("level"),
  createdAt: createdAt(),
});

export const activities = sqliteTable("activities", {
  id: id(),
  org: text("org").notNull(),
  role: text("role"),
  description: text("description"),
  start: text("start"),
  end: text("end"),
  createdAt: createdAt(),
});

export const links = sqliteTable("links", {
  id: id(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  createdAt: createdAt(),
});

export const documents = sqliteTable("documents", {
  id: id(),
  kind: text("kind").notNull().default("resume"), // resume | transcript | portfolio | other
  label: text("label").notNull(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  storagePath: text("storage_path").notNull(),
  parsedText: text("parsed_text"),
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  createdAt: createdAt(),
});

export const recommenders = sqliteTable("recommenders", {
  id: id(),
  name: text("name").notNull(),
  relationship: text("relationship"),
  email: text("email"),
  notes: text("notes"),
  createdAt: createdAt(),
});

// ---------- Writing library (Spellbook) ----------

export const writingSamples = sqliteTable("writing_samples", {
  id: id(),
  title: text("title").notNull(),
  prompt: text("prompt"),
  body: text("body").notNull(),
  tags: text("tags"), // comma separated
  wordCount: integer("word_count").notNull().default(0),
  opportunityId: integer("opportunity_id"),
  createdAt: createdAt(),
});

/**
 * Stories for rule-based cover letters: the student writes the moment once; the generator
 * opens with it, connects it to the role, and calls back to it at the end.
 */
export const stories = sqliteTable("stories", {
  id: id(),
  title: text("title").notNull(), // short noun phrase: "the night our robot wouldn't turn left"
  hook: text("hook").notNull(), // the opening scene, 1–3 sentences, first person
  action: text("action").notNull(), // what you did
  lesson: text("lesson").notNull(), // what it taught you, as a full sentence
  theme: text("theme").notNull(), // 1–3 word noun phrase: "patient debugging"
  tags: text("tags"), // comma separated keywords used to match postings
  createdAt: createdAt(),
});

export const answerBank = sqliteTable("answer_bank", {
  id: id(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  tags: text("tags"),
  lastUsedAt: ts("last_used_at"),
  createdAt: createdAt(),
});

// ---------- Discovery (Quest Board) ----------

export const companies = sqliteTable(
  "companies",
  {
    id: id(),
    name: text("name").notNull(),
    domain: text("domain"),
    ats: text("ats"), // greenhouse | lever | ashby | smartrecruiters | workday | amazon | google | none
    boardId: text("board_id"), // ATS board token; for workday "tenant/wdN/site"
    careersUrl: text("careers_url"),
    tier: text("tier"), // dream | target | safety
    watch: integer("watch", { mode: "boolean" }).default(false),
    lastCheckedAt: ts("last_checked_at"),
    lastOpenCount: integer("last_open_count"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("companies_name_idx").on(t.name)],
);

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  config: json<Record<string, unknown>>("config"),
  lastRunAt: ts("last_run_at"),
  lastStatus: text("last_status"),
  lastCount: integer("last_count"),
});

export const opportunities = sqliteTable(
  "opportunities",
  {
    id: id(),
    externalKey: text("external_key").notNull(), // "<source>:<id>" for dedupe
    type: text("type").$type<OpportunityType>().notNull().default("internship"),
    title: text("title").notNull(),
    org: text("org").notNull(),
    companyId: integer("company_id"),
    location: text("location"),
    remote: integer("remote", { mode: "boolean" }).default(false),
    season: text("season"),
    deadline: text("deadline"), // ISO date
    url: text("url"),
    applyUrl: text("apply_url"),
    ats: text("ats"),
    description: text("description"),
    requirements: json<string[]>("requirements"),
    compensation: text("compensation"),
    eligibility: json<Record<string, unknown>>("eligibility"),
    sourceId: text("source_id"),
    postedAt: ts("posted_at"),
    firstSeenAt: integer("first_seen_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    closedAt: ts("closed_at"),
    fitScore: real("fit_score"),
    fitReason: text("fit_reason"),
    hidden: integer("hidden", { mode: "boolean" }).default(false),
    dedupeKey: text("dedupe_key"),
  },
  (t) => [
    uniqueIndex("opp_external_idx").on(t.externalKey),
    index("opp_dedupe_idx").on(t.dedupeKey),
    index("opp_fit_idx").on(t.fitScore),
  ],
);

// ---------- Tracker (Quest Log) ----------

export const applications = sqliteTable(
  "applications",
  {
    id: id(),
    opportunityId: integer("opportunity_id").notNull(),
    status: text("status").$type<Status>().notNull().default("saved"),
    statusChangedAt: integer("status_changed_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    appliedAt: ts("applied_at"),
    resumeDocumentId: integer("resume_document_id"),
    coverLetterId: integer("cover_letter_id"),
    applyLevel: text("apply_level"), // L0 | L1 | L2 | L3
    priority: integer("priority").default(0),
    notes: text("notes"),
    nextActionAt: ts("next_action_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("app_opp_idx").on(t.opportunityId)],
);

export const applicationEvents = sqliteTable("application_events", {
  id: id(),
  applicationId: integer("application_id").notNull(),
  kind: text("kind").notNull(), // status_change | email | interview | note | reminder | generated
  title: text("title").notNull(),
  detail: text("detail"),
  payload: json<Record<string, unknown>>("payload"),
  origin: text("origin").notNull().default("user"), // user | gmail | system
  occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export type Citation = { sentence: string; itemIds: string[] };

export const generatedDocs = sqliteTable("generated_docs", {
  id: id(),
  kind: text("kind").notNull(), // cover_letter | essay | short_answer | cold_email | follow_up | thank_you
  applicationId: integer("application_id"),
  opportunityId: integer("opportunity_id"),
  title: text("title").notNull(),
  prompt: text("prompt"),
  inputs: json<Record<string, unknown>>("inputs"),
  body: text("body").notNull(),
  citations: json<Citation[]>("citations"),
  gaps: json<string[]>("gaps"),
  unsupported: json<string[]>("unsupported"),
  model: text("model"),
  version: integer("version").notNull().default(1),
  createdAt: createdAt(),
});

export const applicationAnswers = sqliteTable("application_answers", {
  id: id(),
  applicationId: integer("application_id").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  answerBankId: integer("answer_bank_id"),
  createdAt: createdAt(),
});

export const contacts = sqliteTable("contacts", {
  id: id(),
  name: text("name").notNull(),
  role: text("role"), // recruiter | pi | interviewer | referrer
  email: text("email"),
  linkedin: text("linkedin"),
  companyName: text("company_name"),
  applicationId: integer("application_id"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const interviews = sqliteTable("interviews", {
  id: id(),
  applicationId: integer("application_id").notNull(),
  round: text("round").notNull(),
  scheduledAt: ts("scheduled_at"),
  format: text("format"),
  interviewers: text("interviewers"),
  questions: text("questions"),
  notes: text("notes"),
  selfRating: integer("self_rating"),
  createdAt: createdAt(),
});

export const offers = sqliteTable("offers", {
  id: id(),
  applicationId: integer("application_id").notNull(),
  hourly: real("hourly"),
  monthlyStipend: real("monthly_stipend"),
  housing: text("housing"),
  relocation: text("relocation"),
  other: text("other"),
  decisionDeadline: text("decision_deadline"),
  decision: text("decision"), // pending | accepted | declined
  notes: text("notes"),
  createdAt: createdAt(),
});

export const reminders = sqliteTable("reminders", {
  id: id(),
  applicationId: integer("application_id"),
  dueAt: integer("due_at", { mode: "timestamp" }).notNull(),
  text: text("text").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

// ---------- Inbox sync (Messenger) ----------

export const EMAIL_CLASSES = [
  "confirmation",
  "assessment_invite",
  "interview_invite",
  "interview_scheduled",
  "rejection",
  "offer",
  "recruiter_outreach",
  "job_alert",
  "other",
] as const;
export type EmailClass = (typeof EMAIL_CLASSES)[number];

export const emails = sqliteTable(
  "emails",
  {
    id: id(),
    gmailId: text("gmail_id").notNull(),
    threadId: text("thread_id"),
    fromAddress: text("from_address").notNull(),
    subject: text("subject").notNull(),
    snippet: text("snippet"),
    receivedAt: integer("received_at", { mode: "timestamp" }).notNull(),
    classification: text("classification").$type<EmailClass>(),
    confidence: real("confidence"),
    extracted: json<Record<string, unknown>>("extracted"),
    applicationId: integer("application_id"),
    reviewState: text("review_state").notNull().default("pending"), // auto | pending | confirmed | dismissed
  },
  (t) => [uniqueIndex("emails_gmail_idx").on(t.gmailId)],
);

export const oauthTokens = sqliteTable("oauth_tokens", {
  provider: text("provider").primaryKey(),
  accountEmail: text("account_email"),
  scopes: text("scopes"),
  accessTokenEnc: text("access_token_enc"),
  refreshTokenEnc: text("refresh_token_enc"),
  expiresAt: ts("expires_at"),
  lastSyncAt: ts("last_sync_at"),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
