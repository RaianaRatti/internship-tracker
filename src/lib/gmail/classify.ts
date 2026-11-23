import { z } from "zod";
import { EMAIL_CLASSES, type EmailClass, type Status } from "@/db/schema";
import { aiConfigured, extract } from "../ai/client";

export type EmailInput = { from: string; subject: string; body: string };
export type Classified = {
  classification: EmailClass;
  confidence: number;
  company: string | null;
  role: string | null;
  eventDate: string | null;
  jobs?: { title: string; company: string; location: string | null; url: string | null }[];
  by: "rules" | "ai";
};

export const ATS_SENDERS = /greenhouse(-mail)?\.io|lever\.co|ashbyhq\.com|myworkday(jobs)?\.com|icims\.com|smartrecruiters\.com|jobvite\.com|workablemail\.com|successfactors|taleo\.net|eightfold\.ai|avature\.net/i;
const ALERT_SENDERS = /(jobalerts?-noreply|jobs-noreply|jobs-listings)@linkedin\.com|joinhandshake\.com|(alert|jobalerts?|donotreply)@(match\.)?indeed\.com/i;

const RULES: [EmailClass, RegExp, number][] = [
  ["offer", /\b(pleased|happy|excited|delighted) to (extend|offer)|offer letter|extend (you )?an offer|offer of (employment|internship)/i, 0.9],
  ["rejection", /\bunfortunately\b|not (be )?moving forward|move forward with other candidates|decided (not )?to (pursue|proceed with) other|regret to inform|no longer (being )?consider|position has been filled|will not be (moving|proceeding)|not selected/i, 0.9],
  ["assessment_invite", /online assessment|coding (challenge|assessment)|hackerrank|codesignal|codility|technical assessment|complete (the|this|your) assessment/i, 0.88],
  ["interview_scheduled", /interview (is )?(confirmed|scheduled)|^invitation:.*interview|your interview (on|at|with)/i, 0.85],
  ["interview_invite", /schedule (an? |your )?interview|interview (invitation|request)|invite you to (an? )?interview|your availability|next round|phone screen|move (you )?forward to the next/i, 0.85],
  ["confirmation", /thank(s| you) for (applying|your application|your interest)|application (has been )?(received|submitted)|we('ve| have) received your application|successfully applied|application confirmation/i, 0.9],
  ["recruiter_outreach", /came across your (profile|resume)|would love to (chat|connect)|reaching out about (a|an) (role|opportunity)/i, 0.7],
];

/** Fast rule-based pass. AI handles anything below the confidence bar (PLAN.md §7). */
export function classifyByRules(e: EmailInput): Classified {
  const text = `${e.subject}\n${e.body.slice(0, 4000)}`;
  const base = { company: guessCompany(e), role: guessRole(e.subject), eventDate: null, by: "rules" as const };
  if (ALERT_SENDERS.test(e.from)) return { ...base, classification: "job_alert", confidence: 0.95 };
  for (const [cls, re, conf] of RULES) {
    if (re.test(text)) {
      // A rejection often also says "thank you for applying" — rules are ordered so the stronger signal wins.
      const fromAts = ATS_SENDERS.test(e.from);
      return { ...base, classification: cls, confidence: fromAts ? Math.min(0.97, conf + 0.05) : conf };
    }
  }
  return { ...base, classification: "other", confidence: ATS_SENDERS.test(e.from) ? 0.4 : 0.7 };
}

function guessCompany(e: EmailInput): string | null {
  const subj = e.subject.match(/(?:applying to|application (?:to|at|for .+? at)|interest in|from|at)\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})/);
  if (subj) return subj[1].replace(/[.!,]$/, "");
  const display = e.from.match(/^"?([^"<]+?)"?\s*</)?.[1]?.trim();
  if (display && !/no-?reply|notifications?|recruiting team$|careers$/i.test(display)) {
    return display.replace(/\s+(Recruiting|Careers|Talent|Hiring|University Recruiting|Talent Acquisition).*$/i, "").trim() || null;
  }
  const domain = e.from.match(/@([\w.-]+)>?$/)?.[1];
  if (domain && !ATS_SENDERS.test(domain) && !/gmail|outlook|yahoo/.test(domain)) {
    const parts = domain.split(".");
    return parts[parts.length - 2] ?? null;
  }
  return null;
}

function guessRole(subject: string): string | null {
  return subject.match(/\b([\w ,/&-]*?(intern|co-?op|fellow|engineer|analyst|researcher)[\w ,()/&-]*)/i)?.[1]?.trim() ?? null;
}

const AiClass = z.object({
  classification: z.enum(EMAIL_CLASSES),
  confidence: z.number().describe("0 to 1"),
  company: z.string().nullable(),
  role: z.string().nullable(),
  eventDate: z.string().nullable().describe("ISO datetime of an interview/assessment deadline if stated"),
  jobs: z
    .array(z.object({ title: z.string(), company: z.string(), location: z.string().nullable(), url: z.string().nullable() }))
    .describe("Only for job_alert emails: the listed jobs"),
});

export async function classifyEmail(e: EmailInput): Promise<Classified> {
  const rules = classifyByRules(e);
  const needsAi = rules.confidence < 0.85 || rules.classification === "job_alert";
  if (!needsAi || !aiConfigured()) return rules;
  try {
    const r = await extract(AiClass, {
      system:
        "Classify this email from a student's inbox about job/internship/research applications. confirmation = application received; assessment_invite = online assessment/coding test; interview_invite = asked to schedule; interview_scheduled = a confirmed time; rejection; offer; recruiter_outreach = unsolicited recruiter message; job_alert = digest of job listings (extract the jobs); other = unrelated. Extract the hiring company and role.",
      content: `From: ${e.from}\nSubject: ${e.subject}\n\n${e.body.slice(0, 8000)}`,
      maxTokens: 4000,
    });
    return { ...r, by: "ai" };
  } catch {
    return rules;
  }
}

export const CLASS_TO_STATUS: Partial<Record<EmailClass, Status>> = {
  confirmation: "applied",
  assessment_invite: "assessment",
  interview_invite: "interviewing",
  interview_scheduled: "interviewing",
  rejection: "rejected",
  offer: "offer",
};

export const AUTO_APPLY_CONFIDENCE = 0.8;
