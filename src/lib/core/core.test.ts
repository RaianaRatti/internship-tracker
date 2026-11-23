import { describe, expect, it } from "vitest";
import { canAutoTransition } from "./status";
import { dedupeKey, similarity, stripHtml } from "./text";
import { guessSeason, guessType, isStudentRole } from "./classify-title";
import { scoreFit } from "./fit";
import { DEFAULT_PREFERENCES } from "../settings-defaults";

describe("status machine", () => {
  it("moves forward automatically", () => {
    expect(canAutoTransition("applied", "interviewing")).toBe(true);
    expect(canAutoTransition("saved", "applied")).toBe(true);
  });
  it("never moves backwards automatically", () => {
    expect(canAutoTransition("interviewing", "applied")).toBe(false);
    expect(canAutoTransition("offer", "assessment")).toBe(false);
  });
  it("allows rejection from any open state but not after terminal", () => {
    expect(canAutoTransition("interviewing", "rejected")).toBe(true);
    expect(canAutoTransition("accepted", "rejected")).toBe(false);
  });
  it("revives ghosted applications", () => {
    expect(canAutoTransition("ghosted", "interviewing")).toBe(true);
    expect(canAutoTransition("applied", "ghosted")).toBe(true);
    expect(canAutoTransition("interviewing", "ghosted")).toBe(false);
  });
});

describe("text helpers", () => {
  it("builds the same dedupe key across sources", () => {
    expect(dedupeKey("Stripe, Inc.", "Software Engineer Intern (Summer 2027)")).toBe(
      dedupeKey("Stripe", "Software Engineer Intern - Summer 2027"),
    );
  });
  it("strips html", () => {
    expect(stripHtml("<p>Hello&nbsp;<b>world</b></p>")).toBe("Hello world");
  });
  it("scores similar questions higher", () => {
    const a = similarity("Why do you want to work at Stripe?", "Why do you want to work here?");
    const b = similarity("Why do you want to work at Stripe?", "What is your GPA?");
    expect(a).toBeGreaterThan(b);
  });
});

describe("title classification", () => {
  it("detects student roles", () => {
    expect(isStudentRole("Software Engineering Intern, Summer 2027")).toBe(true);
    expect(isStudentRole("Staff Software Engineer")).toBe(false);
  });
  it("guesses type and season", () => {
    expect(guessType("Hardware Co-op")).toBe("coop");
    expect(guessType("Undergraduate Research Program")).toBe("research");
    expect(guessSeason("SWE Intern - summer 2027")).toBe("Summer 2027");
  });
});

describe("fit score", () => {
  it("rewards role, skill, season and tier matches", () => {
    const ctx = {
      prefs: { ...DEFAULT_PREFERENCES, roles: ["software engineer"], seasons: ["Summer 2027"] },
      skills: ["python", "react"],
      companyTiers: new Map([["stripe", "dream"]]),
    };
    const good = scoreFit(
      { title: "Software Engineer Intern", org: "Stripe", season: "Summer 2027", type: "internship", description: "Python and React" },
      ctx,
    );
    const bad = scoreFit({ title: "Accounting Intern", org: "Acme", season: "Fall 2026", type: "internship" }, ctx);
    expect(good.score).toBeGreaterThan(bad.score);
    expect(good.reason).toContain("dream company");
  });
});
