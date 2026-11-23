import type { Preferences } from "@/db/schema";
import { tokenize } from "./text";

export type FitInput = {
  title: string;
  org: string;
  location?: string | null;
  remote?: boolean | null;
  season?: string | null;
  type: string;
  description?: string | null;
};

export type FitContext = {
  prefs: Preferences;
  skills: string[]; // lowercased skill names from the vault
  companyTiers: Map<string, string>; // lowercased company name -> tier
  needsSponsorship?: boolean;
};

const TIER_BONUS: Record<string, number> = { dream: 15, target: 10, safety: 5 };

/** Cheap 0–100 score + one-line reason (PLAN.md §3.3). AI re-rank happens later on top results. */
export function scoreFit(o: FitInput, ctx: FitContext): { score: number; reason: string } {
  const reasons: string[] = [];
  let score = 30;

  const titleTokens = new Set(tokenize(o.title));
  const bodyTokens = new Set([...titleTokens, ...tokenize(o.description)]);

  const roleHit = ctx.prefs.roles.find((r) => tokenize(r).every((t) => titleTokens.has(t)));
  if (roleHit) {
    score += 20;
    reasons.push(`role: ${roleHit}`);
  }

  const skillHits = ctx.skills.filter((s) => bodyTokens.has(s.toLowerCase()));
  if (skillHits.length) {
    score += Math.min(20, skillHits.length * 4);
    reasons.push(`skills: ${skillHits.slice(0, 4).join(", ")}`);
  }

  const kwHits = ctx.prefs.keywords.filter((k) => tokenize(k).every((t) => bodyTokens.has(t)));
  if (kwHits.length) {
    score += Math.min(10, kwHits.length * 5);
    reasons.push(`keywords: ${kwHits.slice(0, 3).join(", ")}`);
  }

  if (ctx.prefs.types.includes(o.type as never)) score += 5;
  else score -= 15;

  if (o.season && ctx.prefs.seasons.length) {
    if (ctx.prefs.seasons.some((s) => s.toLowerCase() === o.season!.toLowerCase())) {
      score += 10;
      reasons.push(o.season);
    } else score -= 20;
  }

  if (ctx.prefs.locations.length) {
    const loc = (o.location ?? "").toLowerCase();
    const locHit = ctx.prefs.locations.find((l) => loc.includes(l.toLowerCase()));
    if (locHit) {
      score += 10;
      reasons.push(`in ${locHit}`);
    } else if (o.remote && ctx.prefs.remoteOk) {
      score += 8;
      reasons.push("remote");
    } else score -= 10;
  }

  const tier = ctx.companyTiers.get(o.org.toLowerCase());
  if (tier) {
    score += TIER_BONUS[tier] ?? 0;
    reasons.push(`${tier} company`);
  }

  if (ctx.needsSponsorship && /no (visa )?sponsorship|must be (a )?u\.?s\.? citizen|security clearance/i.test(o.description ?? "")) {
    score -= 30;
    reasons.push("may not sponsor");
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reason: reasons.join(" · ") || "general match" };
}
