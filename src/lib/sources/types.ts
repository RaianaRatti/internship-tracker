import type { OpportunityType } from "@/db/schema";

/** Normalized posting every adapter produces (PLAN.md §5). */
export type NormalizedPosting = {
  externalKey: string; // "<source>:<id>"
  type: OpportunityType;
  title: string;
  org: string;
  location?: string | null;
  remote?: boolean;
  season?: string | null;
  deadline?: string | null;
  url?: string | null;
  applyUrl?: string | null;
  ats?: string | null;
  description?: string | null;
  compensation?: string | null;
  postedAt?: Date | null;
  active?: boolean;
};

export type CompanyConfig = { id: number; name: string; ats: string; boardId: string };

export interface SourceAdapter {
  id: string;
  label: string;
  /** "company" adapters run once per registry company using that ATS; "global" adapters run once. */
  scope: "company" | "global";
  fetch(ctx: { company?: CompanyConfig; seasons: string[] }): Promise<NormalizedPosting[]>;
}
