import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { getProfile } from "../settings";
import type { Evidence } from "./cover-letter";

/** Everything the rule-based builders need from the Character Sheet, in stable order. */
export async function loadVault() {
  const [profile, education, experiences, projects, skills, activities, links] = await Promise.all([
    getProfile(),
    db.select().from(schema.education).orderBy(asc(schema.education.id)),
    db.select().from(schema.experiences).orderBy(asc(schema.experiences.id)),
    db.select().from(schema.projects).orderBy(asc(schema.projects.id)),
    db.select().from(schema.skills).orderBy(asc(schema.skills.id)),
    db.select().from(schema.activities).orderBy(asc(schema.activities.id)),
    db.select().from(schema.links).orderBy(asc(schema.links.id)),
  ]);
  return { profile, education, experiences, projects, skills, activities, links };
}
export type Vault = Awaited<ReturnType<typeof loadVault>>;

export function splitBullets(text: string | null | undefined): string[] {
  return (text ?? "").split("\n").map((b) => b.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
}

/** Bullets and projects as citable evidence (ids match the AI vault: exp-3.b2, proj-4). */
export function vaultEvidence(v: Vault): Evidence[] {
  return [
    ...v.experiences.flatMap((e) =>
      splitBullets(e.bullets).map((b, i): Evidence => ({ id: `exp-${e.id}.b${i + 1}`, kind: "bullet", org: e.org, role: e.role, text: b, keywords: e.skills })),
    ),
    ...v.projects
      .filter((p) => p.description || p.impact)
      .map((p): Evidence => ({ id: `proj-${p.id}`, kind: "project", org: p.name, text: [p.description, p.impact].filter(Boolean).join(", "), keywords: p.tech })),
  ];
}

/** The most recent school, for "I'm studying X at Y" when a posting asks for a degree. */
export function currentEducation(v: Vault) {
  const e = [...v.education].sort((a, b) => (b.end ?? "").localeCompare(a.end ?? ""))[0];
  return e ? { id: `edu-${e.id}`, school: e.school, degree: e.degree, major: e.major, end: e.end } : null;
}
