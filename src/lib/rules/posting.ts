import { stripHtml, tokenize } from "../core/text";

// Rule-based reading of a job posting: no AI, just headings, bullets and a skills lexicon.

export const SKILL_LEXICON = [
  // languages
  "python", "java", "javascript", "typescript", "c", "c++", "c#", "go", "golang", "rust", "kotlin", "swift", "ruby", "php", "scala", "r", "matlab", "sql", "bash", "haskell", "julia", "verilog", "vhdl", "assembly", "html", "css",
  // frameworks & tools
  "react", "next.js", "node", "node.js", "vue", "angular", "svelte", "django", "flask", "fastapi", "spring", "rails", "express", "graphql", "rest", "grpc",
  "pytorch", "tensorflow", "jax", "keras", "scikit-learn", "pandas", "numpy", "spark", "hadoop", "kafka", "airflow", "dbt", "tableau", "excel", "figma",
  "aws", "gcp", "azure", "docker", "kubernetes", "terraform", "linux", "git", "ci/cd", "postgres", "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "snowflake",
  "ros", "opencv", "cuda", "fpga", "embedded", "unity", "unreal", "ios", "android",
  // domains
  "machine learning", "deep learning", "computer vision", "nlp", "natural language processing", "reinforcement learning", "llm", "llms", "data analysis", "data science", "statistics",
  "distributed systems", "operating systems", "compilers", "networking", "security", "cryptography", "databases", "algorithms", "data structures", "robotics", "control systems",
  "signal processing", "backend", "frontend", "full stack", "mobile", "infrastructure", "devops", "testing", "product design", "ux", "user research", "a/b testing", "finance", "quantitative",
];

export type PostingAnalysis = {
  requirements: string[]; // cleaned requirement phrases, in posting order (degree lines excluded)
  wantsDegree: boolean; // posting asks for a degree / enrollment
  responsibilities: string[];
  mission: string | null; // a sentence about what the company does / believes
  skills: string[]; // lexicon or vault skills mentioned in the posting
  keywords: Set<string>;
};

const REQ_HEAD = /(requirements|qualifications|what you('|’)ll (need|bring)|you (have|bring|might be)|we('|’)re looking for|who you are|about you|minimum|preferred|nice to have|skills)/i;
const RESP_HEAD = /(responsibilities|what you('|’)ll (do|work on)|the role|your impact|in this role|day.to.day)/i;
const OTHER_HEAD = /(benefits|perks|compensation|pay|salary|about us|equal opportunity|eeo|accommodation|location|how to apply|our values)/i;
const MISSION = /\b(mission|we('|’)re (building|on a mission|working to)|we are (building|on a mission|working to)|our goal|we believe|exists to|helps? (people|businesses|companies|developers|teams|students|millions)|is building|empower)/i;

const DEGREE = /\b(degree|bachelor|master|ph\.?d|pursuing|enrolled|graduat|gpa|class standing|year of (study|school)|undergraduate (student|program))/i;

/** "Software Engineering Intern (2027 Start) - Aarhus" -> "Software Engineering Intern" */
export function cleanRole(title: string): string {
  return title
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .split(/\s+[-–—|]\s+|,\s+(?=(summer|fall|winter|spring)\b)/i)[0]
    .replace(/\b(summer|fall|winter|spring)?\s*20\d\d\b:?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lines(description: string): string[] {
  return stripHtml(description)
    .split(/\n|(?<=\.)\s+(?=[A-Z])/)
    .map((l) => l.replace(/^[\s•\-*·▪◦●]+/, "").trim())
    .filter(Boolean);
}

/** "Experience with distributed systems." -> "experience with distributed systems" */
export function cleanRequirement(line: string): string {
  let s = line
    .replace(/\(.*?\)/g, "")
    .replace(/^(you have|you('|’)ve|you are|you('|’)re|have|must have|should have|ideally,? you have|bonus:?|plus:?|preferred:?|required:?)\s+/i, "")
    .replace(/[.;:!]+$/, "")
    .trim();
  // Keep it to one clause so it reads naturally inside a sentence.
  s = s.split(/;|, (?:and |or )?(?:as well as|including|such as|e\.g\.)| — | - /)[0].trim();
  // Adjective phrasing -> noun phrasing so it fits "You're looking for ___".
  const NOUNS: [RegExp, string][] = [
    [/^(highly |very )?proficien(t|cy) (in|with)\s+/i, "proficiency in "],
    [/^(very )?familiar(ity)? with\s+/i, "familiarity with "],
    [/^comfortable (with|in|using)\s+/i, "comfort with "],
    [/^knowledgeable (about|in|of)\s+/i, "knowledge of "],
    [/^skilled (in|at|with)\s+/i, "skill in "],
    [/^(be )?able to\s+/i, "the ability to "],
    [/^(an )?ability to\s+/i, "the ability to "],
    [/^(excited|passionate|enthusiastic) (about|by)\s+/i, "interest in "],
    [/^interested in\s+/i, "interest in "],
    [/^experienced (in|with)\s+/i, "experience with "],
  ];
  for (const [re, rep] of NOUNS) if (re.test(s)) { s = s.replace(re, rep); break; }
  // Long phrases: stop at the first "and" clause.
  if (s.split(/\s+/).length > 10 && / and /.test(s)) s = s.split(/ and /)[0];
  // Long lists ("Finance, Accounting, Economics, …") read badly mid-sentence: keep the first item.
  if (s.split(/\s+/).length > 10 && s.includes(",")) s = s.split(",")[0];
  const words = s.split(/\s+/);
  if (words.length > 14) s = words.slice(0, 14).join(" ");
  s = s.replace(/[,;:]+$/, "").replace(/\s+(and|or|with|of|in|to|the|a|an|for)$/i, "").trim();
  if (!/^[A-Z]{2,}/.test(s)) s = s.charAt(0).toLowerCase() + s.slice(1);
  return s;
}

export function analyzePosting(description: string | null | undefined, extraSkills: string[] = []): PostingAnalysis {
  const all = lines(description ?? "");
  const requirements: string[] = [];
  const responsibilities: string[] = [];
  let mode: "req" | "resp" | "other" | null = null;
  let mission: string | null = null;

  for (const l of all) {
    const isHeading = l.length < 60 && !/[.]$/.test(l) && (REQ_HEAD.test(l) || RESP_HEAD.test(l) || OTHER_HEAD.test(l));
    if (isHeading) {
      mode = REQ_HEAD.test(l) ? "req" : RESP_HEAD.test(l) ? "resp" : "other";
      continue;
    }
    if (!mission && MISSION.test(l) && l.length > 30 && l.length < 200) mission = l.replace(/\s+/g, " ").trim();
    const wc = l.split(/\s+/).length;
    if (wc < 3 || wc > 45) continue;
    if (mode === "req") requirements.push(cleanRequirement(l));
    else if (mode === "resp") responsibilities.push(cleanRequirement(l));
  }

  // No headings found (short postings): treat sentences that mention experience/skills as requirements.
  if (!requirements.length) {
    for (const l of all) {
      if (/\b(experience|familiar|knowledge|proficien|comfortable|ability|skills?|coursework|pursuing|degree)\b/i.test(l) && l.split(/\s+/).length <= 40) {
        requirements.push(cleanRequirement(l));
      }
    }
  }

  const text = ` ${stripHtml(description ?? "").toLowerCase()} `;
  const candidates = [...new Set([...SKILL_LEXICON, ...extraSkills.map((s) => s.toLowerCase())])];
  const skills = candidates.filter((s) => {
    const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`[^a-z0-9+#]${esc}[^a-z0-9+#]`).test(text);
  });

  const isDegree = (r: string) => DEGREE.test(r);
  return {
    requirements: dedupe(requirements).filter((r) => r.length > 8 && !isDegree(r)),
    wantsDegree: requirements.some(isDegree),
    responsibilities: dedupe(responsibilities).filter((r) => r.length > 8),
    mission,
    skills,
    keywords: new Set(tokenize(description)),
  };
}

function dedupe(list: string[]) {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = x.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
