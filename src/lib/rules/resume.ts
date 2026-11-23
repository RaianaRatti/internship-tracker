import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TabStopType, TextRun } from "docx";
import { stemSimilarity } from "../core/text";
import { analyzePosting } from "./posting";
import { splitBullets, type Vault } from "./vault-data";

/**
 * Rule-based, one-page student resume from the Character Sheet.
 * Order: Education, Experience, Projects, Skills, Leadership & Activities (standard for students).
 * Tailoring to a posting only reorders and trims; it never rewrites what the student wrote.
 */

export type ResumeItem = { title: string; right?: string; sub?: string; subRight?: string; bullets: string[]; score: number };
export type ResumeSection = { title: string; items: ResumeItem[]; lines?: string[] };
export type ResumeDoc = { name: string; contact: string[]; sections: ResumeSection[]; notes: string[]; tailoredFor?: string };
export type ResumeOptions = {
  posting?: { title: string; org: string; description: string | null } | null;
  maxBullets?: number;
  maxProjects?: number;
  includeActivities?: boolean;
};

const LINE_BUDGET = 52; // ≈ one US Letter page at 10.5pt with normal margins
const CHARS_PER_LINE = 100;

function yearValue(s?: string | null): number {
  if (!s) return 0;
  if (/present|current|now|ongoing/i.test(s)) return 9999;
  const m = s.match(/(19|20)\d{2}/g);
  if (!m) return 0;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const mi = months.findIndex((mo) => s.toLowerCase().includes(mo));
  return Number(m[m.length - 1]) + (mi >= 0 ? mi / 12 : 0.99);
}

const dates = (a?: string | null, b?: string | null) => (a || b ? `${a ?? ""}${a ? " – " : ""}${b ?? "Present"}` : "");

export function buildResume(v: Vault, opts: ResumeOptions = {}): ResumeDoc {
  const maxBullets = opts.maxBullets ?? 4;
  const notes: string[] = [];
  const postingText = opts.posting ? `${opts.posting.title} ${opts.posting.description ?? ""}` : "";
  const posting = opts.posting ? analyzePosting(opts.posting.description, v.skills.map((s) => s.name)) : null;
  const rel = (t: string) => (posting ? stemSimilarity(t, postingText) + posting.skills.filter((s) => t.toLowerCase().includes(s)).length * 0.05 : 0);
  const p = v.profile;

  const contact = [
    p.email,
    p.phone,
    p.location,
    ...v.links.map((l) => l.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")),
  ].filter(Boolean) as string[];

  // Education
  const education: ResumeSection = {
    title: "Education",
    items: v.education.map((e) => ({
      title: e.school,
      right: dates(e.start, e.end),
      sub: [e.degree && e.major ? `${e.degree} in ${e.major}` : e.degree || e.major, e.minor && `Minor in ${e.minor}`, e.gpa && `GPA ${e.gpa}`].filter(Boolean).join(" · "),
      bullets: [e.coursework && `Relevant coursework: ${e.coursework}`, e.honors && `Honors: ${e.honors}`].filter(Boolean) as string[],
      score: 1,
    })),
  };

  // Experience: reverse chronological; bullets ranked by relevance when tailoring.
  const experience: ResumeSection = {
    title: "Experience",
    items: [...v.experiences]
      .sort((a, b) => yearValue(b.end) - yearValue(a.end) || yearValue(b.start) - yearValue(a.start) || b.id - a.id)
      .map((e) => {
        const bullets = splitBullets(e.bullets);
        const ranked = posting ? [...bullets].sort((a, b) => rel(b) - rel(a)) : bullets;
        return {
          title: e.role,
          right: dates(e.start, e.end),
          sub: e.org,
          subRight: e.location ?? undefined,
          bullets: ranked.slice(0, maxBullets),
          score: Math.max(0, ...bullets.map(rel)),
        };
      }),
  };

  // Projects: most relevant (tailored) or most recent first.
  const projects: ResumeSection = {
    title: "Projects",
    items: [...v.projects]
      .map((pr) => ({
        title: pr.tech ? `${pr.name} | ${pr.tech}` : pr.name,
        right: dates(pr.start, pr.end) || undefined,
        bullets: [pr.description, pr.impact].filter(Boolean).map((x) => x!.trim()).map((x) => x.charAt(0).toUpperCase() + x.slice(1)),
        score: rel(`${pr.name} ${pr.tech ?? ""} ${pr.description ?? ""} ${pr.impact ?? ""}`),
        id: pr.id,
      }))
      .sort((a, b) => (posting ? b.score - a.score : b.id - a.id))
      .slice(0, opts.maxProjects ?? 3),
  };

  // Skills grouped by category; skills the posting mentions go first.
  const groups = new Map<string, string[]>();
  const label: Record<string, string> = { language: "Languages", framework: "Frameworks", tool: "Tools", domain: "Areas", spoken: "Spoken languages", other: "Other" };
  const sortedSkills = [...v.skills].sort((a, b) => Number(posting?.skills.includes(b.name.toLowerCase()) ?? 0) - Number(posting?.skills.includes(a.name.toLowerCase()) ?? 0));
  for (const s of sortedSkills) {
    const g = label[s.category ?? "other"] ?? "Other";
    groups.set(g, [...(groups.get(g) ?? []), s.name]);
  }
  const skills: ResumeSection = { title: "Skills", items: [], lines: [...groups.entries()].map(([g, list]) => `${g}: ${list.join(", ")}`) };

  const activities: ResumeSection = {
    title: "Leadership & Activities",
    items: opts.includeActivities === false ? [] : v.activities.map((a) => ({ title: a.role ? `${a.role}, ${a.org}` : a.org, right: dates(a.start, a.end) || undefined, bullets: a.description ? [a.description] : [], score: rel(`${a.org} ${a.description ?? ""}`) })),
  };

  const doc: ResumeDoc = {
    name: p.name || "Your Name",
    contact,
    sections: [education, experience, projects, skills, activities].filter((s) => s.items.length || s.lines?.length),
    notes,
    tailoredFor: opts.posting ? `${opts.posting.title} at ${opts.posting.org}` : undefined,
  };
  fitToOnePage(doc, notes);
  if (!v.education.length) notes.push("No education yet. Add it in Character → Education.");
  if (!v.experiences.length && !v.projects.length) notes.push("Add experience or projects in your Character Sheet; that's the core of the resume.");
  return doc;
}

export function estimateLines(doc: ResumeDoc): number {
  let n = 3; // name + contact
  for (const s of doc.sections) {
    n += 2;
    for (const it of s.items) {
      n += 1 + (it.sub ? 1 : 0);
      for (const b of it.bullets) n += Math.ceil((b.length + 4) / CHARS_PER_LINE);
    }
    for (const l of s.lines ?? []) n += Math.ceil(l.length / CHARS_PER_LINE);
  }
  return n;
}

/** Trim the least relevant content until the estimate fits one page. */
function fitToOnePage(doc: ResumeDoc, notes: string[]) {
  const section = (t: string) => doc.sections.find((s) => s.title === t);
  const steps: [string, () => boolean][] = [
    ["Shortened activity descriptions", () => !!section("Leadership & Activities")?.items.some((i) => i.bullets.length && (i.bullets = []))],
    ["Kept 2 projects", () => { const p = section("Projects"); return !!p && p.items.length > 2 && !!p.items.splice(2); }],
    ["Kept 3 bullets per role", () => trimBullets(section("Experience"), 3)],
    ["Removed coursework/honors lines", () => !!section("Education")?.items.some((i) => i.bullets.length && (i.bullets = []))],
    ["Kept 2 bullets per role", () => trimBullets(section("Experience"), 2)],
    ["Dropped activities", () => { const i = doc.sections.findIndex((s) => s.title === "Leadership & Activities"); return i >= 0 && !!doc.sections.splice(i, 1); }],
    ["Kept 1 project", () => { const p = section("Projects"); return !!p && p.items.length > 1 && !!p.items.splice(1); }],
  ];
  for (const [label, step] of steps) {
    if (estimateLines(doc) <= LINE_BUDGET) return;
    if (step()) notes.push(`To fit one page: ${label.toLowerCase()}.`);
  }
  if (estimateLines(doc) > LINE_BUDGET) notes.push("Still longer than one page. Shorten some bullets in your Character Sheet.");
}

function trimBullets(s: ResumeSection | undefined, n: number) {
  if (!s) return false;
  let changed = false;
  for (const it of s.items) if (it.bullets.length > n) { it.bullets = it.bullets.slice(0, n); changed = true; }
  return changed;
}

// ---------- export ----------

const FONT = "Calibri";
const run = (text: string, o: { bold?: boolean; italics?: boolean; size?: number } = {}) => new TextRun({ text, font: FONT, size: o.size ?? 21, bold: o.bold, italics: o.italics });
const RIGHT_TAB = 10800; // twips: 7.5in text width

export async function resumeToDocx(doc: ResumeDoc): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [run(doc.name, { bold: true, size: 32 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [run(doc.contact.join("  |  "), { size: 19 })] }),
  ];
  for (const s of doc.sections) {
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
        children: [run(s.title.toUpperCase(), { bold: true, size: 21 })],
      }),
    );
    for (const it of s.items) {
      children.push(
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
          children: [run(it.title, { bold: true }), ...(it.right ? [run(`\t${it.right}`)] : [])],
        }),
      );
      if (it.sub) {
        children.push(
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
            children: [run(it.sub, { italics: true }), ...(it.subRight ? [run(`\t${it.subRight}`, { italics: true })] : [])],
          }),
        );
      }
      for (const b of it.bullets) children.push(new Paragraph({ bullet: { level: 0 }, children: [run(b)] }));
    }
    for (const l of s.lines ?? []) {
      const [head, ...rest] = l.split(": ");
      children.push(new Paragraph({ children: [run(`${head}: `, { bold: true }), run(rest.join(": "))] }));
    }
  }
  const d = new Document({
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children }],
  });
  return Packer.toBuffer(d);
}
