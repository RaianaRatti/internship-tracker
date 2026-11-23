import { describe, expect, it } from "vitest";
import { classifyByRules } from "./classify";
import { pickMatch } from "./match";

const mail = (from: string, subject: string, body = "") => ({ from, subject, body });

describe("email rules", () => {
  it("detects confirmations from ATS senders", () => {
    const r = classifyByRules(mail("Stripe <no-reply@us.greenhouse-mail.io>", "Thank you for applying to Stripe"));
    expect(r.classification).toBe("confirmation");
    expect(r.company).toBe("Stripe");
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });
  it("prefers rejection over the polite thank-you", () => {
    const r = classifyByRules(
      mail("Figma Recruiting <no-reply@greenhouse.io>", "Your application", "Thank you for applying. Unfortunately we will not be moving forward."),
    );
    expect(r.classification).toBe("rejection");
  });
  it("detects assessments and interviews", () => {
    expect(classifyByRules(mail("x@hackerrank.com", "Complete your HackerRank coding challenge")).classification).toBe("assessment_invite");
    expect(classifyByRules(mail("recruiter@acme.com", "Next steps", "Please share your availability to schedule an interview")).classification).toBe("interview_invite");
  });
  it("routes LinkedIn alerts to discovery", () => {
    expect(classifyByRules(mail("LinkedIn <jobalerts-noreply@linkedin.com>", "30 new jobs for software intern")).classification).toBe("job_alert");
  });
});

describe("email matching", () => {
  const candidates = [
    { applicationId: 1, org: "Stripe", title: "Software Engineer Intern" },
    { applicationId: 2, org: "Stripe", title: "Data Science Intern" },
    { applicationId: 3, org: "Figma", title: "Software Engineer Intern" },
  ];
  it("matches by company then role", () => {
    const m = pickMatch(candidates, { from: "no-reply@greenhouse.io", subject: "Stripe: Data Science Intern application", body: "", company: "Stripe", role: "Data Science Intern" });
    expect(m?.applicationId).toBe(2);
  });
  it("returns null without a company match", () => {
    expect(pickMatch(candidates, { from: "a@b.com", subject: "Hello", body: "", company: "Notion", role: null })).toBeNull();
  });
});
