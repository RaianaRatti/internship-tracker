import type { Status } from "@/db/schema";

export const STATUS_LABEL: Record<Status, string> = {
  saved: "Saved",
  preparing: "Preparing",
  applied: "Applied",
  assessment: "Assessment",
  interviewing: "Interviewing",
  offer: "Offer",
  accepted: "Accepted",
  declined: "Declined",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  ghosted: "Ghosted",
};

/** Kanban columns, in pipeline order. Terminal states share the last columns. */
export const BOARD_COLUMNS: Status[][] = [
  ["saved"],
  ["preparing"],
  ["applied"],
  ["assessment"],
  ["interviewing"],
  ["offer"],
  ["accepted", "declined"],
  ["rejected", "withdrawn", "ghosted"],
];

const RANK: Record<Status, number> = {
  saved: 0,
  preparing: 1,
  applied: 2,
  ghosted: 2.5,
  assessment: 3,
  interviewing: 4,
  offer: 5,
  accepted: 6,
  declined: 6,
  rejected: 6,
  withdrawn: 6,
};

export const TERMINAL: Status[] = ["accepted", "declined", "rejected", "withdrawn"];

export function isTerminal(s: Status) {
  return TERMINAL.includes(s);
}

/** Statuses that mean we've heard back (used for response-rate stats). */
export const RESPONDED: Status[] = ["assessment", "interviewing", "offer", "accepted", "declined", "rejected"];

/**
 * Automatic transitions (from Gmail or the system) only move forward, so a late
 * "thanks for applying" never undoes "Interviewing" (PLAN.md §7). Ghosted can be
 * revived by any real signal. Users can always set any status manually.
 */
export function canAutoTransition(from: Status, to: Status): boolean {
  if (from === to) return false;
  if (isTerminal(from)) return false;
  if (to === "ghosted") return from === "applied";
  if (to === "rejected" || to === "withdrawn") return true;
  if (from === "ghosted") return RANK[to] >= RANK.applied;
  return RANK[to] > RANK[from];
}
