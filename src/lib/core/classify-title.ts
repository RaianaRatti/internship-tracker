import type { OpportunityType } from "@/db/schema";

const STUDENT_RE =
  /\b(intern(ship)?s?|co-?op|student|university|undergrad(uate)?|new grad(uate)?|graduate program|early career|apprentice(ship)?|fellow(ship)?|scholar(ship)?|summer analyst|research assistant|explore|step)\b/i;

/** ATS boards list every job; only keep ones a student would apply to. */
export function isStudentRole(title: string): boolean {
  return STUDENT_RE.test(title);
}

export function guessType(title: string, fallback: OpportunityType = "internship"): OpportunityType {
  const t = title.toLowerCase();
  if (/\bco-?op\b/.test(t)) return "coop";
  if (/\bnew grad|early career|university graduate|entry level\b/.test(t)) return "new_grad";
  if (/\bfellow(ship)?\b/.test(t)) return "fellowship";
  if (/\bscholar(ship)?\b/.test(t)) return "scholarship";
  if (/\breu\b|research (intern|assistant|program)|undergraduate research/.test(t)) return "research";
  if (/\b(explore|step|insight|externship|freshman|sophomore|first.year|discovery)\b/.test(t)) return "early_program";
  if (/\bintern/.test(t)) return "internship";
  return fallback;
}

export function guessSeason(text: string): string | null {
  const m = text.match(/\b(summer|fall|winter|spring)\s*(20\d\d)\b/i);
  if (!m) return null;
  return `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${m[2]}`;
}
