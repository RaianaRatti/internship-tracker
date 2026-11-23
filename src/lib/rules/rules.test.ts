import { describe, expect, it } from "vitest";
import { analyzePosting, cleanRequirement, cleanRole } from "./posting";
import { article, bulletToClause, composeCoverLetter, matchEvidence, rankStories, toGerundPhrase, type Evidence } from "./cover-letter";

const DESC = `<p>At Figma, our mission is to make design accessible to everyone.</p>
<h3>What you'll do</h3><ul><li>Build features in our React and TypeScript web app used by millions of designers.</li><li>Collaborate with designers and PMs to ship polished user experiences.</li></ul>
<h3>Qualifications</h3><ul><li>Experience building web applications with React or similar frameworks.</li><li>Familiarity with performance profiling and debugging complex systems.</li><li>Strong communication skills and an interest in design tools.</li></ul>
<h3>Benefits</h3><ul><li>Housing stipend</li></ul>`;

const EVIDENCE: Evidence[] = [
  { id: "exp-1.b1", kind: "bullet", org: "CMU Robotics Club", role: "web lead", text: "Rebuilt the club website in React and TypeScript, cutting load time from 6s to 0.8s" },
  { id: "exp-1.b2", kind: "bullet", org: "CMU Robotics Club", role: "web lead", text: "Ran weekly design reviews with 4 student designers" },
  { id: "exp-2.b1", kind: "bullet", org: "Prof. Lee's HCI Lab", role: "research assistant", text: "Profiled and debugged a Python data pipeline, removing a memory leak that crashed overnight runs" },
  { id: "proj-1", kind: "project", org: "StudyBuddy", text: "a web app that matches classmates into study groups, used by 300 students" },
];

const STORY = {
  id: 1,
  title: "the week our club's site kept crashing during registration",
  hook: "Two days before our robotics club's fall registration, our sign-up site started crashing every time more than twenty people opened it.",
  action: "I stayed up profiling the page, found an image carousel re-rendering on every keystroke, and rewrote it so the page loaded in under a second.",
  lesson: "I learned that the details users never see are often what decide whether they stay.",
  theme: "patience with the invisible details",
  tags: "debugging, performance, web",
};

describe("posting analysis", () => {
  const a = analyzePosting(DESC, ["React"]);
  it("splits requirements and responsibilities by heading and skips benefits", () => {
    expect(a.requirements).toContain("experience building web applications with React or similar frameworks");
    expect(a.responsibilities[0]).toMatch(/^build features/);
    expect(a.requirements.join(" ")).not.toMatch(/housing/i);
  });
  it("finds the mission line and skills", () => {
    expect(a.mission).toMatch(/mission is to make design accessible/);
    expect(a.skills).toEqual(expect.arrayContaining(["react", "typescript"]));
  });
  it("keeps degree lines out of requirements but remembers them", () => {
    const d = analyzePosting("<h3>Qualifications</h3><ul><li>Currently pursuing a Bachelor's degree in Computer Science</li><li>Experience with Python and SQL</li></ul>");
    expect(d.wantsDegree).toBe(true);
    expect(d.requirements).toEqual(["experience with Python and SQL"]);
  });
  it("cleans role titles", () => {
    expect(cleanRole("Software Engineering Intern (2027 Start) - Aarhus")).toBe("Software Engineering Intern");
    expect(cleanRole("Summer 2027 Data Science Intern")).toBe("Data Science Intern");
  });
  it("cleans requirement phrasing", () => {
    expect(cleanRequirement("You have 2+ years of experience with Python (or Go).")).toBe("2+ years of experience with Python");
  });
});

describe("phrasing helpers", () => {
  it("turns bullets into first-person clauses", () => {
    expect(bulletToClause("Built a ROS pipeline.")).toBe("I built a ROS pipeline");
    expect(bulletToClause("Leading a team of 4")).toBe("I worked on leading a team of 4");
    expect(bulletToClause("API design for the club app")).toBe("my work included API design for the club app");
  });
  it("picks a/an", () => {
    expect(article("B.S. in CS")).toBe("a");
    expect(article("M.S. in CS")).toBe("an");
    expect(article("Research Assistant")).toBe("a");
    expect(article("engineer")).toBe("an");
  });
  it("makes gerunds", () => {
    expect(toGerundPhrase("build features")).toBe("building features");
    expect(toGerundPhrase("collaborate with designers")).toBe("collaborating with designers");
    expect(toGerundPhrase("ship code")).toBe("shipping code");
  });
});

describe("cover letter", () => {
  const posting = analyzePosting(DESC, ["Python", "React", "TypeScript"]);
  const letter = composeCoverLetter({ name: "Sam Rivera", org: "Figma", role: "Software Engineering Intern", story: STORY, posting, evidence: EVIDENCE, vaultSkills: ["Python", "React", "TypeScript"], tone: "warm", variant: 0 });

  it("opens with the story and calls back to it at the end", () => {
    expect(letter.paragraphs[0].text.startsWith(STORY.hook)).toBe(true);
    expect(letter.paragraphs[3].text).toContain(STORY.title);
    expect(letter.paragraphs[3].text).toContain(STORY.theme);
  });
  it("ties requirements to distinct evidence, including stemmed matches", () => {
    const m = matchEvidence(posting, EVIDENCE);
    expect(m.length).toBeGreaterThanOrEqual(2);
    expect(new Set(m.map((x) => x.evidence.id.split(".")[0])).size).toBe(m.length);
    expect(m.map((x) => x.evidence.id)).toContain("exp-2.b1"); // "profiling/debugging" ↔ "Profiled and debugged"
  });
  it("addresses the company and never says 'our app'", () => {
    expect(letter.paragraphs[2].text).not.toMatch(/\bour (react|web|app)/i);
    expect(letter.body).toMatch(/^Dear Figma Hiring Team,/);
    expect(letter.body.trim().endsWith("Sam Rivera")).toBe(true);
  });
  it("falls back to a placeholder instead of inventing a reason", () => {
    const l = composeCoverLetter({ name: "S", org: "Acme", role: "Intern", story: STORY, posting: analyzePosting("<h3>Requirements</h3><ul><li>Experience with COBOL mainframes</li></ul>"), evidence: EVIDENCE, vaultSkills: [], tone: "formal", variant: 1 });
    expect(l.body).toContain("[ADD:");
    expect(l.checks.find((c) => c.label.includes("placeholder"))?.ok).toBe(false);
  });
  it("varies wording by variant", () => {
    const other = composeCoverLetter({ name: "Sam Rivera", org: "Figma", role: "Software Engineering Intern", story: STORY, posting, evidence: EVIDENCE, vaultSkills: ["React"], tone: "warm", variant: 1 });
    expect(other.paragraphs[1].text).not.toBe(letter.paragraphs[1].text);
  });
  it("ranks stories by theme overlap", () => {
    const other = { ...STORY, id: 2, theme: "leading a team", tags: "leadership", lesson: "People follow clarity.", action: "I organized volunteers." };
    expect(rankStories([other, STORY], DESC)[0].story.id).toBe(1);
  });
});
