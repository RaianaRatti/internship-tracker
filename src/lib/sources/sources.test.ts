import { describe, expect, it } from "vitest";
import { boardFromUrl } from "./detect";
import { parseWorkdayUrl } from "./workday";
import { jobPostingFromJsonLd } from "./url-import";
import { parseGoogleCareersHtml } from "./google";
import { atsFromUrl, normalizeListing } from "./simplify";

describe("ATS URL parsing", () => {
  it("recognizes job board URLs", () => {
    expect(boardFromUrl("https://boards.greenhouse.io/stripe")).toEqual({ ats: "greenhouse", boardId: "stripe" });
    expect(boardFromUrl("https://jobs.lever.co/palantir/abc")).toEqual({ ats: "lever", boardId: "palantir" });
    expect(boardFromUrl("https://jobs.ashbyhq.com/ramp")).toEqual({ ats: "ashby", boardId: "ramp" });
    expect(boardFromUrl("https://example.com/careers")).toBeNull();
  });
  it("parses Workday URLs into tenant/wd/site + job path", () => {
    expect(parseWorkdayUrl("https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/US-CA-Santa-Clara/Intern_JR1")).toEqual({
      boardId: "nvidia/wd5/NVIDIAExternalCareerSite",
      jobPath: "/job/US-CA-Santa-Clara/Intern_JR1",
    });
  });
  it("labels ATS from listing URLs", () => {
    expect(atsFromUrl("https://cmu.wd115.myworkdayjobs.com/cmu/job/x")).toBe("workday");
    expect(atsFromUrl("https://stripe.com/jobs?gh_jid=1")).toBe("greenhouse");
  });
});

describe("page parsers", () => {
  it("reads schema.org JobPosting markup", () => {
    const html = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"JobPosting","title":"Research Intern","hiringOrganization":{"name":"Acme Labs"},"description":"<p>Do science</p>","validThrough":"2027-01-15T00:00:00Z","jobLocation":{"address":{"addressLocality":"Boston","addressRegion":"MA"}}}</script>`;
    const p = jobPostingFromJsonLd(html, "https://acme.example/jobs/1")!;
    expect(p.title).toBe("Research Intern");
    expect(p.org).toBe("Acme Labs");
    expect(p.deadline).toBe("2027-01-15");
    expect(p.location).toBe("Boston, MA");
    expect(p.type).toBe("research");
  });
  it("parses Google's embedded careers data", () => {
    const row = ["123", "Software Engineering Intern, Summer 2027", "u", [null, "<p>Build things</p>"], [null, "<p>Quals</p>"], "x", null, "Google", "en", [["Mountain View, CA, USA"]], [null, "About"]];
    const html = `<script>AF_initDataCallback({key: 'ds:1', hash: '2', data:${JSON.stringify([[row], null, 1, 20])}, sideChannel: {}});</script>`;
    const [job] = parseGoogleCareersHtml(html);
    expect(job.externalKey).toBe("google:123");
    expect(job.season).toBe("Summer 2027");
    expect(job.location).toBe("Mountain View, CA, USA");
  });
  it("normalizes SimplifyJobs listings", () => {
    const p = normalizeListing(
      { id: "x", company_name: "CMU", title: "AI Intern", url: "https://cmu.wd115.myworkdayjobs.com/cmu/job/a", locations: ["Pittsburgh, PA"], terms: ["Summer 2027"], active: true, is_visible: true, date_posted: 1794787200 },
      "SimplifyJobs/Summer2027-Internships",
    );
    expect(p).toMatchObject({ externalKey: "simplify:x", season: "Summer 2027", ats: "workday", type: "internship" });
  });
});
