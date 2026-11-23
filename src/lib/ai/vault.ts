import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { getProfile } from "../settings";

/**
 * Serialize the Character Sheet into a stable, citable text block. Every fact has an id
 * like [exp-3.b2] so generated text can cite exactly where each claim came from (PLAN.md §6).
 * EEO answers are never included (PLAN.md §11). Ordering is deterministic so the block caches.
 */
export async function buildVaultContext(): Promise<{ text: string; ids: Set<string> }> {
  const [p, edu, exp, proj, sk, act, lnk] = await Promise.all([
    getProfile(),
    db.select().from(schema.education).orderBy(asc(schema.education.id)),
    db.select().from(schema.experiences).orderBy(asc(schema.experiences.id)),
    db.select().from(schema.projects).orderBy(asc(schema.projects.id)),
    db.select().from(schema.skills).orderBy(asc(schema.skills.id)),
    db.select().from(schema.activities).orderBy(asc(schema.activities.id)),
    db.select().from(schema.links).orderBy(asc(schema.links.id)),
  ]);
  const ids = new Set<string>();
  const L: string[] = ["<student_vault>"];
  const add = (id: string, line: string) => {
    ids.add(id);
    L.push(`[${id}] ${line}`);
  };
  const range = (a?: string | null, b?: string | null) => (a || b ? ` (${a ?? "?"} – ${b ?? "present"})` : "");

  add("profile", [p.name, p.pronouns && `(${p.pronouns})`, p.location && `· ${p.location}`, p.classYear && `· ${p.classYear}`, p.graduationDate && `· graduating ${p.graduationDate}`].filter(Boolean).join(" "));
  if (p.headline) add("profile.headline", p.headline);
  if (p.summary) add("profile.summary", p.summary);
  if (p.workAuthorization) add("profile.auth", `Work authorization: ${p.workAuthorization}; needs sponsorship: ${p.needsSponsorship ? "yes" : "no"}`);

  for (const e of edu)
    add(`edu-${e.id}`, `${e.degree ?? ""} ${e.major ?? ""}${e.minor ? `, minor ${e.minor}` : ""} at ${e.school}${range(e.start, e.end)}${e.gpa ? ` · GPA ${e.gpa}` : ""}${e.coursework ? ` · Coursework: ${e.coursework}` : ""}${e.honors ? ` · Honors: ${e.honors}` : ""}`);
  for (const e of exp) {
    add(`exp-${e.id}`, `${e.role} at ${e.org} [${e.kind}]${e.location ? `, ${e.location}` : ""}${range(e.start, e.end)}${e.skills ? ` · Skills: ${e.skills}` : ""}`);
    (e.bullets ?? "").split("\n").map((b) => b.replace(/^[-•*]\s*/, "").trim()).filter(Boolean).forEach((b, i) => add(`exp-${e.id}.b${i + 1}`, b));
  }
  for (const pr of proj)
    add(`proj-${pr.id}`, `${pr.name}${range(pr.start, pr.end)}: ${pr.description ?? ""}${pr.tech ? ` · Tech: ${pr.tech}` : ""}${pr.impact ? ` · Impact: ${pr.impact}` : ""}${pr.url ? ` · ${pr.url}` : ""}`);
  if (sk.length) add("skills", sk.map((s) => `${s.name}${s.level ? ` (${s.level})` : ""}`).join(", "));
  for (const a of act) add(`act-${a.id}`, `${a.role ?? "Member"} at ${a.org}${range(a.start, a.end)}${a.description ? `: ${a.description}` : ""}`);
  for (const l of lnk) add(`link-${l.id}`, `${l.label}: ${l.url}`);
  L.push("</student_vault>");
  return { text: L.join("\n"), ids };
}
