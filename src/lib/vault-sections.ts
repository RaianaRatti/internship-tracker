import { schema } from "@/db";

export type Field = { name: string; label: string; type?: "text" | "textarea" | "select" | "url"; options?: string[]; required?: boolean; hint?: string };

/** Field definitions drive the generic Character Sheet editors. */
export const SECTIONS = {
  education: {
    label: "Education",
    table: schema.education,
    title: (r: Record<string, unknown>) => `${r.school}`,
    subtitle: (r: Record<string, unknown>) => [r.degree, r.major, r.gpa && `GPA ${r.gpa}`].filter(Boolean).join(" · "),
    fields: [
      { name: "school", label: "School", required: true },
      { name: "degree", label: "Degree", hint: "B.S." },
      { name: "major", label: "Major" },
      { name: "minor", label: "Minor" },
      { name: "gpa", label: "GPA" },
      { name: "start", label: "Start", hint: "Aug 2024" },
      { name: "end", label: "End / expected", hint: "May 2028" },
      { name: "coursework", label: "Relevant coursework", type: "textarea" },
      { name: "honors", label: "Honors", type: "textarea" },
    ] as Field[],
  },
  experiences: {
    label: "Experience",
    table: schema.experiences,
    title: (r: Record<string, unknown>) => `${r.role} @ ${r.org}`,
    subtitle: (r: Record<string, unknown>) => [r.kind, r.start && `${r.start} – ${r.end ?? "present"}`].filter(Boolean).join(" · "),
    fields: [
      { name: "role", label: "Role", required: true },
      { name: "org", label: "Organization", required: true },
      { name: "kind", label: "Kind", type: "select", options: ["job", "internship", "research", "ta", "volunteer"] },
      { name: "location", label: "Location" },
      { name: "start", label: "Start" },
      { name: "end", label: "End" },
      { name: "bullets", label: "Bullets (one per line)", type: "textarea" },
      { name: "skills", label: "Skills used" },
    ] as Field[],
  },
  projects: {
    label: "Projects",
    table: schema.projects,
    title: (r: Record<string, unknown>) => `${r.name}`,
    subtitle: (r: Record<string, unknown>) => `${r.tech ?? ""}`,
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "tech", label: "Tech stack" },
      { name: "url", label: "Link", type: "url" },
      { name: "start", label: "Start" },
      { name: "end", label: "End" },
      { name: "description", label: "What it is", type: "textarea" },
      { name: "impact", label: "Impact / metrics", type: "textarea" },
    ] as Field[],
  },
  skills: {
    label: "Skills",
    table: schema.skills,
    title: (r: Record<string, unknown>) => `${r.name}`,
    subtitle: (r: Record<string, unknown>) => [r.category, r.level].filter(Boolean).join(" · "),
    fields: [
      { name: "name", label: "Skill", required: true },
      { name: "category", label: "Category", type: "select", options: ["language", "framework", "tool", "domain", "spoken", "other"] },
      { name: "level", label: "Level", type: "select", options: ["", "beginner", "intermediate", "advanced", "native"] },
    ] as Field[],
  },
  activities: {
    label: "Activities & leadership",
    table: schema.activities,
    title: (r: Record<string, unknown>) => `${r.role ?? "Member"} @ ${r.org}`,
    subtitle: (r: Record<string, unknown>) => `${r.start ?? ""}${r.end ? ` – ${r.end}` : ""}`,
    fields: [
      { name: "org", label: "Organization", required: true },
      { name: "role", label: "Role" },
      { name: "start", label: "Start" },
      { name: "end", label: "End" },
      { name: "description", label: "Description", type: "textarea" },
    ] as Field[],
  },
  links: {
    label: "Links",
    table: schema.links,
    title: (r: Record<string, unknown>) => `${r.label}`,
    subtitle: (r: Record<string, unknown>) => `${r.url}`,
    fields: [
      { name: "label", label: "Label", required: true, hint: "GitHub" },
      { name: "url", label: "URL", type: "url", required: true },
    ] as Field[],
  },
  recommenders: {
    label: "Recommenders",
    table: schema.recommenders,
    title: (r: Record<string, unknown>) => `${r.name}`,
    subtitle: (r: Record<string, unknown>) => [r.relationship, r.email].filter(Boolean).join(" · "),
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "relationship", label: "Relationship", hint: "Research advisor" },
      { name: "email", label: "Email" },
      { name: "notes", label: "Asked for / submitted", type: "textarea" },
    ] as Field[],
  },
} as const;

export type SectionKey = keyof typeof SECTIONS;
