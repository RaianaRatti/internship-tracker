import type { Preferences } from "@/db/schema";

export const DEFAULT_PREFERENCES: Preferences = {
  roles: ["software engineer", "data", "machine learning", "research"],
  keywords: [],
  locations: [],
  remoteOk: true,
  seasons: ["Summer 2027"],
  types: ["internship", "research", "early_program", "fellowship", "scholarship"],
  ghostDays: 30,
  followUpDays: 14,
};
