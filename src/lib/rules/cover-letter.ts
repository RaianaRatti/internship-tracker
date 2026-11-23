import { similarity, stem, tokenize, wordCount } from "../core/text";
import { cleanRole, type PostingAnalysis } from "./posting";

/**
 * Rule-based cover letters. Structure (the student's request):
 *   1. Open with the student's own story.
 *   2. Bridge: the lesson from the story -> why this role at this company.
 *   3. Fit: 2–3 of the posting's requirements, each tied to one piece of real evidence.
 *   4. Close by calling back to the story.
 * Nothing is invented: every sentence is either the student's own words, a fixed template,
 * or a fact copied from their Character Sheet.
 */

export type StoryInput = { id: number; title: string; hook: string; action: string; lesson: string; theme: string; tags?: string | null };
/** `text` is what the letter quotes; `keywords` (tech stack, skills used) only help matching. */
export type Evidence = { id: string; kind: "bullet" | "project"; org: string; role?: string | null; text: string; keywords?: string | null };
export type EducationFact = { id: string; school: string; degree?: string | null; major?: string | null; end?: string | null };
export type Tone = "warm" | "formal";

export type LetterInput = {
  name: string;
  org: string;
  role: string;
  contactName?: string | null;
  story: StoryInput;
  posting: PostingAnalysis;
  evidence: Evidence[];
  vaultSkills: string[];
  whyCompany?: string | null;
  education?: EducationFact | null;
  tone: Tone;
  variant: number;
};

export type Match = { requirement: string; kind: "requirement" | "responsibility"; evidence: Evidence; score: number };
export type Check = { ok: boolean; label: string; detail?: string };
export type Letter = {
  salutation: string;
  paragraphs: { text: string; citations: string[] }[];
  signoff: string;
  body: string;
  matches: Match[];
  checks: Check[];
};

// ---------- small text helpers ----------

const sentence = (s: string) => {
  const t = s.trim().replace(/\s+/g, " ");
  return /[.!?…"”)]$/.test(t) ? t : `${t}.`;
};
const noEnd = (s: string) => s.trim().replace(/[.!?]+$/, "");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string) => (/^[A-Z]{2,}|^[A-Z][a-z]*[A-Z]/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
/** "a B.S.", "an M.S.", "an Electrical…": vowel sounds, including spelled-out initials. */
export const article = (w: string) => (/^[aeiou]/i.test(w) || /^[FHLMNRSX](\.|[A-Z]|$)/.test(w) ? "an" : "a");
const pick = <T,>(arr: T[], i: number) => arr[((i % arr.length) + arr.length) % arr.length];

export function listJoin(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const PAST_VERB = /^(\w+ed|built|led|wrote|ran|made|taught|won|drove|grew|cut|set|took|gave|found|sped|shipped|spun|brought|kept|held|met|sold|told|thought|began|rebuilt|rewrote|undertook|oversaw|co-?\w+ed|re\w+ed)\b/i;
const GERUND = /^\w+ing\b/i;

/** Turn a resume bullet into a first-person clause: "Built X" -> "I built X". */
export function bulletToClause(bullet: string): string {
  const b = noEnd(bullet.replace(/^[-•*]\s*/, ""));
  if (PAST_VERB.test(b)) return `I ${lowerFirst(b)}`;
  if (GERUND.test(b)) return `I worked on ${lowerFirst(b)}`;
  return `my work included ${lowerFirst(b)}`;
}

/**
 * Phrase one piece of evidence two ways:
 *   lead:    "at CMU Robotics Club, I rebuilt…"   /  "on my own, I built StudyBuddy, a web app…"
 *   pointTo: "my time as web lead at CMU Robotics Club, where I rebuilt…"  /  "StudyBuddy, a web app…"
 */
function evidenceParts(e: Evidence) {
  if (e.kind === "project") {
    const desc = noEnd(e.text);
    const verbDesc = PAST_VERB.test(desc);
    return {
      lead: verbDesc ? `for my project ${e.org}, I ${lowerFirst(desc)}` : `on my own, I built ${e.org}, ${lowerFirst(desc)}`,
      pointTo: verbDesc ? `my project ${e.org}, where I ${lowerFirst(desc)}` : `${e.org}, ${lowerFirst(desc)}`,
    };
  }
  const clause = bulletToClause(e.text);
  return {
    lead: `at ${e.org}, ${clause}`,
    pointTo: `my time ${e.role ? `as ${article(e.role)} ${e.role} ` : ""}at ${e.org}, where ${clause}`,
  };
}

/** "build features in our app" -> "building features in your app" */
export function toGerundPhrase(phrase: string): string {
  const words = phrase.split(" ");
  const w = words[0].toLowerCase();
  let g: string;
  if (w.endsWith("ing")) g = w;
  else if (/ie$/.test(w)) g = w.slice(0, -2) + "ying";
  else if (/[^e]e$/.test(w)) g = w.slice(0, -1) + "ing";
  else if (/^[^aeiou]*[aeiou][bdgmnprt]$/.test(w) && w.length <= 4) g = w + w.slice(-1) + "ing";
  else g = w + "ing";
  return [g, ...words.slice(1)].join(" ");
}

/** Posting phrases speak as the company ("our app"); in the letter they're addressed to it. */
function addressed(phrase: string) {
  return phrase.replace(/\bour\b/gi, "your").replace(/\bwe\b/gi, "you").replace(/\bus\b/g, "you");
}


// ---------- matching ----------

/** Pair posting requirements with the strongest, distinct pieces of evidence. */
// Words every posting and resume use; sharing them says nothing about fit.
const GENERIC = new Set(
  (
    "design develop development work team teams software system systems experience ability skill strong build using use new including related " +
    "lab weekly meeting project projects tool tools engineering engineer knowledge understanding familiarity solution technical help support " +
    "participate participating assist assisting across within role intern internship candidate year years plus well good great excellent " +
    "student students university program implement implementation work-related environment opportunity company product products people"
  )
    .split(" ")
    .map(stem),
);
const meaningful = (text: string) => new Set(tokenize(text).map(stem).filter((t) => t.length > 2 && !GENERIC.has(t)));

/**
 * Pair posting requirements with the strongest, distinct pieces of evidence. A pair needs real
 * overlap: two meaningful shared words, or one shared technical skill. A weak match is worse than
 * an honest gap, so anything less is left out.
 */
export function matchEvidence(posting: PostingAnalysis, evidence: Evidence[], max = 3): Match[] {
  const reqs: [string, Match["kind"]][] = [
    ...posting.requirements.slice(0, 10).map((r) => [r, "requirement"] as [string, Match["kind"]]),
    ...posting.responsibilities.slice(0, 8).map((r) => [r, "responsibility"] as [string, Match["kind"]]),
  ];
  const evTokens = evidence.map((e) => meaningful(`${e.text} ${e.keywords ?? ""}`));
  const scored: Match[] = [];
  for (const [r, kind] of reqs) {
    const R = meaningful(r);
    const rLower = r.toLowerCase();
    evidence.forEach((e, i) => {
      const E = evTokens[i];
      let shared = 0;
      for (const t of R) if (E.has(t)) shared++;
      const evText = `${e.text} ${e.keywords ?? ""}`.toLowerCase();
      const skillHits = posting.skills.filter((s) => rLower.includes(s) && evText.includes(s)).length;
      if (shared < 2 && skillHits === 0) return;
      const score = shared / Math.sqrt(Math.max(1, R.size) * Math.max(1, E.size)) + 0.2 * skillHits + (kind === "requirement" ? 0.01 : 0);
      scored.push({ requirement: r, kind, evidence: e, score });
    });
  }
  scored.sort((a, b) => b.score - a.score);
  const usedReq = new Set<string>();
  const usedParent = new Set<string>();
  const out: Match[] = [];
  for (const m of scored) {
    const parent = m.evidence.id.split(".")[0];
    if (usedReq.has(m.requirement) || usedParent.has(parent)) continue;
    out.push(m);
    usedReq.add(m.requirement);
    usedParent.add(parent);
    if (out.length >= max) break;
  }
  return out;
}

/** Rank stories by how well their themes fit this posting. */
export function rankStories(stories: StoryInput[], postingText: string): { story: StoryInput; score: number }[] {
  return stories
    .map((s) => ({ story: s, score: similarity(`${s.theme} ${s.tags ?? ""} ${s.lesson} ${s.action}`, postingText) }))
    .sort((a, b) => b.score - a.score);
}

// ---------- composition ----------

const CLICHES = [
  "i am writing to express",
  "i am writing to apply",
  "passionate about",
  "hard-working",
  "hardworking",
  "team player",
  "think outside the box",
  "go-getter",
  "detail-oriented",
  "synergy",
  "results-driven",
  "to whom it may concern",
  "perfect fit",
  "dream job",
];

export function composeCoverLetter(input: LetterInput): Letter {
  const { org, story, posting, tone, variant: v } = input;
  const role = cleanRole(input.role) || input.role;
  const warm = tone === "warm";

  // 1. Story — the student's own words, untouched apart from punctuation.
  const p1 = `${sentence(story.hook)} ${sentence(story.action)}`;

  // 2. Bridge — lesson, then why this company.
  const bridge = warm
    ? pick(
        [
          `It's a big part of why the ${role} role at ${org} caught my attention.`,
          `That's the thread that led me to the ${role} role at ${org}.`,
          `So when I came across the ${role} position at ${org}, it felt like the natural next step.`,
        ],
        v,
      )
    : pick(
        [
          `This experience is a large part of why I am applying for the ${role} position at ${org}.`,
          `That lesson is what draws me to the ${role} position at ${org}.`,
        ],
        v,
      );
  let why: string;
  if (input.whyCompany?.trim()) why = sentence(input.whyCompany);
  else if (posting.mission) {
    const m = noEnd(posting.mission).replace(/"/g, "'");
    why = warm ? `When I read "${m}," it clicked.` : `${org}'s description of its work ("${m}") resonates with me.`;
  } else why = `[ADD: one sentence on why ${org} specifically, in your own words]`;
  const p2 = `${sentence(story.lesson)} ${bridge} ${why}`;

  // 3. Fit — requirement ↔ evidence pairs, plus overlapping skills.
  const matches = matchEvidence(posting, input.evidence, 3);
  // A degree requirement is met by education, stated as a plain fact from the Character Sheet.
  const edu = input.education;
  let eduSentence: string | null = null;
  if (posting.wantsDegree && edu) {
    const study = [edu.degree, edu.major && `in ${edu.major}`].filter(Boolean).join(" ") || "my degree";
    eduSentence = (
      warm
        ? `I'm currently studying for ${article(study)} ${study} at ${edu.school}${edu.end ? `, graduating ${edu.end}` : ""}.`
        : `I am pursuing ${article(study)} ${study} at ${edu.school}${edu.end ? ` (expected ${edu.end})` : ""}.`
    );
  }
  type Parts = ReturnType<typeof evidenceParts>;
  const reqTemplates: ((req: string, e: Parts) => string)[] = warm
    ? [
        (r, e) => `You're looking for ${r}, and that's something I already have: ${e.lead}.`,
        (r, e) => `The posting asks for ${r}. ${cap(e.lead)}.`,
        (r, e) => `For ${r}, I'd point to ${e.pointTo}.`,
      ]
    : [
        (r, e) => `The role calls for ${r}. ${cap(e.lead)}.`,
        (r, e) => `Regarding ${r}: ${e.lead}.`,
        (r, e) => `My background in ${r} comes from ${e.pointTo}.`,
      ];
  const respTemplates: ((g: string, e: Parts) => string)[] = warm
    ? [
        (g, e) => `The role involves ${g}, and that's work I've done: ${e.lead}.`,
        (g, e) => `${cap(g)} is close to what I've been doing already. ${cap(e.lead)}.`,
        (g, e) => `Since the role involves ${g}, I'd point to ${e.pointTo}.`,
      ]
    : [
        (g, e) => `The position involves ${g}. ${cap(e.lead)}.`,
        (g, e) => `I am prepared for ${g}: ${e.lead}.`,
      ];
  const fitSentences = matches.map((m, i) => {
    const parts = evidenceParts(m.evidence);
    return m.kind === "responsibility"
      ? pick(respTemplates, v + i)(addressed(toGerundPhrase(m.requirement)), parts)
      : pick(reqTemplates, v + i)(addressed(m.requirement), parts);
  });
  if (eduSentence) fitSentences.unshift(eduSentence);
  const said = fitSentences.join(" ").toLowerCase();
  const skills = input.vaultSkills.filter((s) => posting.skills.includes(s.toLowerCase()) && !said.includes(s.toLowerCase())).slice(0, 4);
  if (skills.length >= 2) {
    fitSentences.push(
      warm
        ? pick([`I'm also comfortable with ${listJoin(skills)}, which show up throughout the posting.`, `Along the way I've gotten hands-on with ${listJoin(skills)}.`], v)
        : `I am also proficient in ${listJoin(skills)}, which the role lists.`,
    );
  }
  if (!matches.length) {
    fitSentences.unshift(`[ADD: two concrete examples from your experience that match what ${org} is asking for. Your Character Sheet didn't have close matches for this posting]`);
  } else if (matches.length === 1) {
    const unmatched = posting.requirements.find((r) => r !== matches[0].requirement) ?? posting.responsibilities[0];
    if (unmatched) fitSentences.push(`[ADD: an example that shows ${addressed(unmatched)}]`);
  }
  const p3 = fitSentences.join(" ");

  // 4. Close — call back to the story.
  const title = noEnd(story.title);
  const theme = noEnd(story.theme).toLowerCase();
  const callback = warm
    ? pick(
        [
          `I still think about ${title}. ${org} looks like a place where that kind of problem is everyday work, and I'd love to bring the same ${theme} to your team.`,
          `Whenever I think back to ${title}, what stays with me is ${theme}. That's exactly what I hope to bring to the ${role} role at ${org}.`,
          `${cap(title)} is why I want to do this kind of work, and I'd be excited to bring that same ${theme} to ${org}.`,
        ],
        v,
      )
    : pick(
        [
          `The lesson of ${title} still guides how I work, and I would welcome the opportunity to bring that same ${theme} to ${org}.`,
          `${cap(title)} taught me the value of ${theme}, and I would be glad to bring it to the ${role} position at ${org}.`,
        ],
        v,
      );
  const thanks = warm ? "Thank you for your time. I'd love the chance to talk more." : "Thank you for your consideration. I would welcome the opportunity to discuss my application.";
  const p4 = `${callback} ${thanks}`;

  const salutation = `Dear ${input.contactName?.trim() || `${org} Hiring Team`},`;
  const signoff = `${warm ? "Best" : "Sincerely"},\n${input.name || "[ADD: your name]"}`;
  const paragraphs = [
    { text: p1, citations: [`story-${story.id}`] },
    { text: p2, citations: [`story-${story.id}`] },
    { text: p3, citations: [...(posting.wantsDegree && edu ? [edu.id] : []), ...matches.map((m) => m.evidence.id), ...(skills.length >= 2 ? ["skills"] : [])] },
    { text: p4, citations: [`story-${story.id}`] },
  ];
  const body = [salutation, ...paragraphs.map((p) => p.text), signoff].join("\n\n");

  return { salutation, paragraphs, signoff, body, matches, checks: checkLetter(body, input, matches) };
}

/** Quality checks shown next to the draft (all rule-based). */
export function checkLetter(body: string, input: LetterInput, matches: Match[]): Check[] {
  const words = wordCount(body);
  const lower = body.toLowerCase();
  const orgMentions = lower.split(input.org.toLowerCase()).length - 1;
  const ownWords = [input.story.hook, input.story.action, input.story.lesson, input.whyCompany ?? ""].join(" ").toLowerCase();
  const cliches = CLICHES.filter((c) => lower.includes(c) || ownWords.includes(c));
  const reused = matches.filter((m) => m.evidence.kind === "bullet").length;
  const placeholders = (body.match(/\[ADD:/g) ?? []).length;
  return [
    { ok: words >= 220 && words <= 420, label: `${words} words`, detail: words < 220 ? "A bit short. Add detail to your story or a third example." : words > 420 ? "Long. Most readers skim after ~400 words." : "Good length (250–400 is typical)." },
    { ok: orgMentions >= 2, label: `Mentions ${input.org} ${orgMentions}×`, detail: orgMentions >= 2 ? undefined : "Name the company at least twice so it reads tailored." },
    { ok: matches.length >= 2, label: `${matches.length} requirement(s) tied to your experience`, detail: matches.length >= 2 ? matches.map((m) => `“${m.requirement}”`).join(" · ") : "Add more experience/project detail to your Character Sheet, or try another posting/story." },
    { ok: reused <= 2, label: reused ? `Reuses ${reused} resume line(s)` : "No resume lines reused", detail: reused ? "Those sentences quote your resume. Rewording them in your own voice makes the letter feel less like a resume recap." : undefined },
    { ok: !cliches.length, label: cliches.length ? `Clichés: ${cliches.join(", ")}` : "No clichés found" },
    { ok: !placeholders, label: placeholders ? `${placeholders} placeholder(s) to fill` : "No placeholders left" },
  ];
}
