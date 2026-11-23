import fs from "node:fs";
import YAML from "yaml";
import type { OpportunityType } from "@/db/schema";

export type CuratedProgram = {
  name: string;
  org: string;
  type: OpportunityType;
  url: string;
  typical_deadline?: string;
  summary?: string;
  eligibility: { class_years?: string[]; citizenship?: "us" | "us_or_pr" | "any" };
  list: "research" | "fellowships" | "scholarships";
};

export function loadCurated(): CuratedProgram[] {
  const files: [string, string, CuratedProgram["list"]][] = [
    ["data/research_programs.yaml", "programs", "research"],
    ["data/fellowships.yaml", "fellowships", "fellowships"],
    ["data/scholarships.yaml", "scholarships", "scholarships"],
  ];
  return files.flatMap(([file, key, list]) => {
    if (!fs.existsSync(file)) return [];
    const doc = YAML.parse(fs.readFileSync(file, "utf8")) as Record<string, Omit<CuratedProgram, "list">[]>;
    return (doc[key] ?? []).map((p) => ({ ...p, eligibility: p.eligibility ?? {}, list }));
  });
}

/** Eligibility check against the vault (PLAN.md §5.6). Returns reasons the student may be ineligible. */
export function eligibilityIssues(
  p: CuratedProgram,
  student: { classYear?: string | null; workAuthorization?: string | null },
): string[] {
  const issues: string[] = [];
  const year = student.classYear?.toLowerCase();
  if (p.eligibility.class_years?.length && year && !p.eligibility.class_years.includes(year)) {
    issues.push(`for ${p.eligibility.class_years.join("/")}`);
  }
  const auth = (student.workAuthorization ?? "").toLowerCase();
  if (auth) {
    const isCitizen = /citizen/.test(auth) && !/not a (us |u\.s\. )?citizen|non-?citizen/.test(auth);
    const isPr = /permanent resident|green card/.test(auth);
    if (p.eligibility.citizenship === "us" && !isCitizen) issues.push("US citizens only");
    if (p.eligibility.citizenship === "us_or_pr" && !isCitizen && !isPr) issues.push("US citizens / permanent residents");
  }
  return issues;
}
