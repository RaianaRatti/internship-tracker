# QUEST LOG — Opportunity Tracker for Students

> A 1-bit, pixel-art (pure black & white) app that finds, prepares, tracks and follows up on every opportunity a student wants: internships, co-ops, research labs, fellowships, scholarships, and programs.

Working name: **QUEST LOG**. Each opportunity is a "quest" and each application moves through stages. The game framing is light; the app is first a serious productivity tool.

---

## 1. Goals

1. **One source of truth** for every application: where you applied, when, with which resume, and what happened.
2. **A personal data vault** holding everything about the student (education, experience, projects, skills, links, documents, writing samples, reusable answers) so no form is filled out from scratch twice.
3. **Discovery**: pull opportunities from big tech career sites, ATS job boards, curated lists, research programs and email alerts, filtered to what the student says they want.
4. **Generation**: tailored cover letters, supplemental essays and cold emails to professors, grounded in the student's real data and written in their voice.
5. **Assisted applying**: pre-fill applications and open them ready to submit, with the student reviewing and clicking submit.
6. **Inbox sync**: connect Gmail and update application status automatically (confirmation, assessment, interview, rejection, offer).

### Non-goals (v1)
- Mass "spray and pray" auto-applying with no review. It hurts the student's candidacy, breaks site Terms of Service, and is easy to detect. See §4.
- Scraping sites that forbid it (LinkedIn, Handshake). We use legal routes instead (§5.3).

---

## 2. Opportunity Types

Every opportunity has a `type`, and the UI, filters and generation prompts adapt to it:

| Type | Examples | Typical asks |
|---|---|---|
| `internship` | SWE/PM/design/data internships, big tech & startups | Resume, cover letter (sometimes), short answers |
| `coop` | 4–12 month co-ops | Same as internship, plus availability term |
| `early_program` | Freshman/sophomore programs (e.g. explore-style, insight days, externships) | Essays, "why this program" |
| `research` | REUs, SURF-style summer research, national lab programs, joining a campus lab | Statement of interest, faculty contact, transcript, recommenders |
| `fellowship` | Funded fellowships, diversity fellowships | Long essays, recommendations |
| `scholarship` | Merit/need/conference scholarships | Essays, transcript |
| `event` | Hackathons, conferences, career fairs | Registration, travel grant essays |
| `new_grad` | Full-time roles (for later years) | Resume, cover letter |
| `other` | Anything the student adds manually | Free-form |

---

## 3. Features

### 3.1 Profile Vault ("Character Sheet")
A structured store of everything about the student. It is filled in once and reused everywhere.

- **Basics**: name, pronouns (optional), email, phone, location, work authorization, willingness to relocate, graduation date, links (GitHub, LinkedIn, portfolio, Google Scholar).
- **Education**: schools, degree, major/minor, GPA, relevant coursework, honors.
- **Experience**: jobs, internships, TA roles, research, with bullet points stored as separate items so they can be picked per application.
- **Projects**: description, tech stack, links, impact metrics.
- **Skills**: languages, frameworks, tools, spoken languages, with proficiency.
- **Activities & leadership**: clubs, volunteering, awards.
- **Documents**: multiple resume versions (SWE, research, general), transcript, portfolio PDFs. Versions are kept, and each application records which version it used.
- **Recommenders**: name, relationship, contact, which applications they were asked for, and whether they submitted.
- **EEO / demographic answers** (optional, stored encrypted, never sent to the AI).
- **Resume import**: upload a PDF/DOCX resume and the AI pre-fills the vault. The student confirms each field.

### 3.2 Writing Library ("Spellbook")
- **Writing samples**: past essays, statements of purpose, personal statements, research statements, cover letters. Each has a title, original prompt, word count, tags (`why-company`, `challenge`, `leadership`, `diversity`, `research-interest`, `failure`, `teamwork`, …), and the opportunity it was written for.
- **Answer bank**: canonical answers to common short questions ("Why do you want to work here?", "Describe a project you're proud of", "Expected graduation?", "Are you authorized to work…?"). Questions are deduplicated by meaning, so a new form question is matched to an existing answer.
- **Voice profile**: built from the samples (sentence length, tone, words the student uses or avoids) and used to keep generated text sounding like them.
- Every new essay written in the app is saved back to the library automatically.

### 3.3 Discovery ("Quest Board")
- **Preferences**: target companies (with tiers such as dream / target / safety), roles, locations or remote, seasons (Summer 2027, Fall 2027 co-op…), opportunity types, minimum pay, sponsorship needs, class year.
- **Feed**: new opportunities from every source (§5), deduplicated, ranked by fit, with "NEW" badges and deadlines.
- **Fit score**: a 0–100 score from keyword and skill overlap, eligibility (class year, citizenship, GPA cutoffs) and preference match, followed by an AI re-rank of the top results with a one-line reason ("matches your React + research experience").
- **Watchlist**: companies with no posting yet. The app checks them daily and notifies when one opens. Big tech internships often open in late summer or early fall.
- **Manual add**: paste a URL and the app fetches and parses the posting (title, company, location, deadline, requirements).

### 3.4 Tracker ("Quest Log")
- **Pipeline (kanban)**: `Saved → Preparing → Applied → Assessment → Interviewing → Offer → Accepted / Declined`, plus the terminal states `Rejected`, `Withdrawn` and `Ghosted` (set automatically after N days of silence, which the student can configure).
- **Table view** with sorting and filters (type, status, company, deadline, source).
- **Application detail page**: timeline of events (applied, emails, interviews, notes), resume version used, cover letter used, essay answers submitted, contacts, links, salary, interview prep notes.
- **Deadlines & reminders**: upcoming deadlines, follow-up nudges ("applied 14 days ago, no response; send a follow-up?"), recommender reminders.
- **Interview tracking**: rounds, dates, interviewer names, questions asked, self-rating.
- **Offers**: compensation, deadline to decide, side-by-side comparison.

### 3.5 Generator ("Forge")
- **Cover letters**: built from the student's profile, the job description, optional company research and the voice profile.
- **Supplemental essays**: answers application prompts within word limits, starting from the closest writing samples.
- **Short answers**: filled from the answer bank and adapted to the company.
- **Research cold emails**: emails to professors or PIs that reference their recent papers (§5.5).
- **Follow-up and thank-you emails** after interviews.
- **Resume tailoring**: suggests which existing bullets to include or reorder for a given job. It never invents new experience.
- **Export**: PDF and DOCX, plus copy to clipboard. Exported files use a clean, standard style rather than the pixel style.

See §6 for the generation pipeline and the rules that prevent made-up content.

### 3.6 Apply Assistant ("Auto-Fill")
See §4. A browser extension fills application forms from the vault, and the student reviews and submits.

### 3.7 Inbox Sync ("Messenger")
See §7. Connects Gmail, reads only application-related mail, and moves applications through the pipeline.

### 3.8 Stats ("Stats Screen")
- Counts by stage (a funnel), response rate, interview rate and offer rate by source, type and resume version.
- Applications per week, plotted as a pixel bar chart.
- Average time to first response per company.
- "Which resume version gets more interviews?" so the student can A/B test their resume.

### 3.9 Calendar
- Deadlines, assessments and interviews shown in a month grid.
- Optional Google Calendar sync (interviews detected from email become events).

---

## 4. Applying: What's Realistic

Full automatic submission across all sites is not realistically possible or advisable:

- **LinkedIn, Handshake and Indeed forbid automation** in their Terms of Service. Accounts get restricted or banned, and Handshake is tied to the student's university account.
- **Big tech portals** (Workday, Eightfold, custom sites) use logins, CAPTCHAs, multi-page flows and frequent layout changes.
- **Quality**: recruiters notice generic, unreviewed applications. One bad AI answer can sink an application.
- **ATS "apply" APIs** (e.g. Greenhouse's application endpoint) require the *employer's* API key, so a student-side app cannot use them.

So the app offers increasing levels of help, and the student always clicks the final submit:

| Level | What happens | Where it works |
|---|---|---|
| **L0 Track** | Student applies themselves and logs it with one click (or the email confirmation logs it automatically) | Everywhere |
| **L1 Prepare** | App builds an "application packet": tailored resume pick, cover letter, essay answers, short answers. Opens the apply page with everything ready to copy. | Everywhere |
| **L2 Autofill** | Browser extension detects the form and fills fields from the vault and packet. Student reviews and submits. The app logs the submission. | Greenhouse, Lever, Ashby, SmartRecruiters, Workday, iCIMS and common custom forms |
| **L3 Batch prepare** | Select 10 matching jobs, then generate packets for all; the student goes through them one by one in the extension | Same as L2 |

Possible later (not in v1): unattended submit on simple single-page ATS forms (Greenhouse/Lever) with Playwright, **off by default**, with a per-application approval step and strict rate limits. Only build this if L2 proves too slow in practice.

---

## 5. Opportunity Sources

Each source is an **adapter** behind one interface:

```ts
interface SourceAdapter {
  id: string;                          // "greenhouse", "simplify-github", ...
  fetch(params: SourceParams): Promise<RawPosting[]>;
  normalize(raw: RawPosting): Opportunity; // map to the common schema
}
```

A scheduled worker runs adapters (every 6–24h depending on source), normalizes, deduplicates (by ATS id, then by company + title + location similarity) and stores results. Each adapter has fixture-based tests so we notice when a site changes.

### 5.1 Public ATS job boards (reliable, public JSON)
Most startups and mid-size companies host jobs on these. Given a company's board name, we can list all its jobs.

| ATS | Endpoint |
|---|---|
| Greenhouse | `GET https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true` |
| Lever | `GET https://api.lever.co/v0/postings/{company}?mode=json` |
| Ashby | `GET https://api.ashbyhq.com/posting-api/job-board/{org}?includeCompensation=true` |
| SmartRecruiters | `GET https://api.smartrecruiters.com/v1/companies/{company}/postings` |
| Workday | Each company's careers site calls `POST https://{tenant}.wd{N}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs`. Not documented and may change; needs a per-company config. |

We maintain a **company registry** (`companies.yaml`) mapping company → ATS + board id, seeded with a few hundred tech companies and editable by the user. When a student adds a target company, the app tries to detect its ATS automatically from its careers page.

### 5.2 Big tech career sites (custom adapters)
Google, Microsoft, Amazon, Apple, Meta and similar run their own career sites. Each needs a small custom adapter that reads the JSON the careers site itself loads, filtered to internship / university / student roles. These are **the most fragile adapters**: they get monitoring, polite rate limits, and a fallback (the curated lists in §5.4 usually cover these companies within a day).

### 5.3 LinkedIn & Handshake (no scraping)
Neither offers a public API for student job search, and both forbid scraping. Instead:
1. **Job alert emails**: the student sets up job alerts on LinkedIn/Handshake/Indeed. Gmail sync (§7) parses those alert emails into the feed. This is legal, reliable, and covers the student's own filters.
2. **Browser extension clipper**: a "Save to Quest Log" button on a LinkedIn/Handshake/Indeed posting page that the student is already viewing. It reads the page the student has open, which is equivalent to copy-paste.
3. **Handshake export**: if the student's school allows it, import saved jobs or applications from CSV.

### 5.4 Curated lists (high signal for internships)
- **Community GitHub lists** of tech internships (e.g. the SimplifyJobs `Summer20XX-Internships` repos, plus off-season and new grad lists). Several publish a machine-readable `listings.json`; otherwise parse the README table. Checked hourly while recruiting season is open.
- **Public job APIs**: USAJobs API (federal internships and Pathways), Adzuna API (broad coverage, free tier), The Muse API.

### 5.5 Research opportunities
- **REU sites**: the NSF REU site list (by field), refreshed each season.
- **Summer research programs**: a curated `research_programs.yaml` (university SURF-style programs, national lab internships, NIH/DOE student programs) with typical deadlines, updated yearly.
- **Faculty finder** for joining a lab: search **OpenAlex** and **Semantic Scholar** (both free, open APIs) by research interest + institution to find active professors and their recent papers. The app suggests PIs, summarizes their recent work, and drafts a cold email that references it.
- **University lab pages**: the student adds a lab URL; the app parses PI, topics and "join us" instructions.

### 5.6 Fellowships, scholarships, events
- Curated `fellowships.yaml` / `scholarships.yaml` with eligibility rules (class year, major, demographics, citizenship) and deadlines, which the app filters against the vault.
- Hackathons from public event listings (e.g. MLH's season list).
- Conference scholarships and travel grants added to the same list.

---

## 6. AI Generation Pipeline

**Model**: Anthropic Claude API. `claude-sonnet-5-5` for cover letters, essays and emails. `claude-haiku-4-5` for cheap, high-volume work (parsing postings, classifying emails, matching questions to the answer bank, fit re-ranking). Use prompt caching for the profile + voice profile, since they are reused in every call.

**Cover letter / essay flow**:
1. **Extract** the job's requirements, values and keywords from the posting (structured JSON).
2. **Retrieve** the most relevant vault items (experiences, projects, bullets) and 2–3 closest writing samples.
3. **Map** each requirement to evidence: every claim in the draft must cite a vault item id. Requirements with no evidence are reported as gaps, never filled in.
4. **Draft** with the voice profile, word limit and tone (formal for research, warmer for startups).
5. **Check**: a second pass verifies that every factual claim traces to a vault item and that the word limit holds. Unsupported sentences are highlighted for the student.
6. **Edit**: side-by-side editor with "shorter", "more specific", "more like me" and "regenerate paragraph" actions.
7. **Save** the final version to the application and the writing library.

**Rules**:
- Never invent experience, numbers, awards or skills.
- Placeholders such as `[ADD: why you care about this team]` appear where the student's own input is needed.
- EEO and demographic data are never sent to the model.
- Every AI output is stored with its inputs, so the student can see why something was written.

---

## 7. Gmail Integration

**Auth**: Google OAuth with the `gmail.readonly` scope (requested separately, only when the student turns on inbox sync). `gmail.readonly` is a restricted scope: for personal use the Google Cloud project stays in "Testing" mode (up to 100 test users). A public launch would need Google's security review. Optional `calendar.events` scope for calendar sync.

**Sync**:
- First sync scans the last ~12 months with a query that narrows to likely recruiting mail (ATS senders such as `greenhouse.io`, `lever.co`, `ashbyhq.com`, `myworkday.com`, `icims.com`; keywords such as "application", "interview", "assessment", "offer", "unfortunately", "next steps"; and domains of companies in the tracker).
- Then incremental sync with `users.history.list` every few minutes, or real-time with `users.watch` + Google Pub/Sub.
- Only matching messages are stored (sender, subject, date, snippet, and the extracted fields). Full bodies are processed and discarded.

**Classification** (Haiku, structured output):
`confirmation | assessment_invite | interview_invite | interview_scheduled | rejection | offer | recruiter_outreach | job_alert | other`, plus extracted company, role, dates/links and a confidence score.

**Matching to applications**: by ATS sender + company, then company domain, then fuzzy role title. If nothing matches, a confirmation email creates a new "Applied" entry, which catches applications made outside the app.

**Status updates**:
- High confidence: update automatically and add a timeline event ("Rejected, detected from email on Nov 3").
- Low confidence: put the email in a **Review Inbox** for one-click confirm or fix.
- Status never moves backwards automatically (e.g. a late "thanks for applying" will not undo "Interviewing").
- Job alert emails (LinkedIn/Handshake/Indeed) are routed to the discovery parser (§5.3).

Outlook / school Microsoft 365 accounts can be added later through Microsoft Graph with the same pipeline.

---

## 8. Design System: 1-Bit Pixel

The whole UI uses **only two colors: #000000 and #FFFFFF**. Every shade of gray is a dither pattern.

- **Fonts**: a pixel display font for headings (e.g. *Press Start 2P* or *Silkscreen*) and a more readable pixel font for body text (e.g. *VT323* or *Pixelify Sans*) at sizes that stay legible (body ≥ 18px for VT323). Monospace numbers for tables.
- **Shapes**: no border radius, 2px solid borders, hard 4px offset shadows (a solid black box, not blur). Pixel-stepped corners on dialogs via `clip-path`.
- **Fills & states**: dither patterns (checkerboard, Bayer 2×2/4×4) as tiny base64 PNG or SVG backgrounds with `image-rendering: pixelated`. Hover = invert colors. Active/pressed = shadow removed and element shifted 4px.
- **Status without color**: since we can't use red/green, every status has a pattern + icon + label:
  - Saved: outline only
  - Applied: light dither
  - Assessment / Interviewing: heavy dither
  - Offer: solid black with a star icon
  - Rejected: diagonal hatch + strikethrough
  - Ghosted: dotted border
- **Icons**: `pixelarticons` (MIT) plus a few custom 16×16 sprites.
- **Dark mode**: a full invert (white on black), switched by the system setting or a toggle.
- **Motion**: stepped animations only (`steps()` timing): blinking cursor, typewriter text for AI output, a progress bar that fills in blocks. All animations respect `prefers-reduced-motion`.
- **Optional extras**: 8-bit sound effects on status changes (off by default), a small sprite that reacts to offers and rejections.
- **Accessibility**: black/white is maximum contrast. Focus rings are thick and inverted. Patterns always come with text labels. Everything works by keyboard (`j/k` to move, `a` add, `/` search).

Screens: Title screen (login) → Dashboard ("Quest Board" feed + deadlines + funnel) → Quest Log (kanban/table) → Application detail → Character Sheet (vault) → Spellbook (writing) → Forge (generator) → Messenger (review inbox) → Settings.

---

## 9. Architecture & Stack

```
┌──────────────────────┐     ┌───────────────────────┐
│  Web app (Next.js)   │◀──▶│  API routes / server  │
│  pixel UI            │     │  actions (TypeScript) │
└──────────────────────┘     └──────────┬────────────┘
┌──────────────────────┐                │
│ Browser extension    │◀───────────────┤
│ (autofill + clipper) │                ▼
└──────────────────────┘     ┌───────────────────────┐
                             │ Postgres (+ pgvector) │
┌──────────────────────┐     └──────────▲────────────┘
│ Worker / scheduler   │────────────────┘
│ - source adapters    │──▶ ATS APIs, career sites, GitHub lists,
│ - Gmail sync         │    OpenAlex, Semantic Scholar, USAJobs…
│ - reminders          │──▶ Gmail API / Pub/Sub, Google Calendar
│ - AI jobs            │──▶ Claude API
└──────────────────────┘
```

| Layer | Choice | Why |
|---|---|---|
| Web app | **Next.js (App Router) + TypeScript** | One codebase for UI and API |
| Styling | Tailwind CSS with a custom 1-bit theme, or plain CSS modules | Easy to enforce two colors via tokens |
| DB | **Postgres** (Supabase or Neon) with **Drizzle ORM**; **pgvector** for matching questions and samples | Relational data + search in one place |
| Auth | **Auth.js** with Google sign-in (Gmail scope requested later, separately) | Same Google account for login and Gmail |
| Jobs | **Inngest** or **Trigger.dev** (scheduled + background jobs with retries); a plain cron worker also works for single-user | Adapters and sync need retries and schedules |
| AI | **Anthropic SDK** (`@anthropic-ai/sdk`) | Generation, parsing, classification |
| Embeddings | Voyage AI (or a local model) | For pgvector similarity |
| Extension | **Chrome MV3** built with **WXT** (React) | Autofill + clipper, shares types with the web app |
| Docs export | `@react-pdf/renderer` for PDF, `docx` for Word | Clean exports |
| Testing | Vitest (unit + adapter fixtures), Playwright (e2e) | Adapters break often; fixtures catch it |
| Hosting | Vercel (web) + managed Postgres; or fully local with Docker for privacy | Start local, deploy later |

Monorepo layout:

```
internship-tracker/
├── apps/
│   ├── web/                 # Next.js app (UI + API)
│   └── extension/           # WXT browser extension
├── packages/
│   ├── db/                  # Drizzle schema, migrations
│   ├── core/                # shared types, status machine, fit scoring
│   ├── sources/             # source adapters + fixtures
│   ├── ai/                  # prompts, generation pipeline, classifiers
│   ├── gmail/               # Gmail sync + matching
│   └── ui/                  # 1-bit pixel component library
├── data/
│   ├── companies.yaml       # company → ATS registry
│   ├── research_programs.yaml
│   ├── fellowships.yaml
│   └── scholarships.yaml
└── PLAN.md
```

---

## 10. Data Model (core tables)

All tables have `id`, `user_id`, `created_at` and `updated_at`, so the app can serve more than one student later.

- `profiles`: basics, preferences (JSON), voice profile
- `education`, `experiences`, `experience_bullets`, `projects`, `skills`, `activities`, `links`
- `documents`: kind (`resume|transcript|portfolio|other`), version label, file url, parsed text
- `recommenders`
- `writing_samples`: title, prompt, body, tags[], word_count, embedding, source_opportunity_id
- `answer_bank`: canonical_question, answer, embedding, last_used_at
- `companies`: name, domain, ats, ats_board_id, careers_url, tier (dream/target/safety)
- `sources`: adapter id, config, last_run_at, last_status
- `opportunities`: type, title, company_id / org name, location, remote, season, deadline, url, apply_url, ats, external_id, description, requirements (JSON), compensation, eligibility (JSON), source_id, first_seen_at, closed_at, fit_score, fit_reason
- `applications`: opportunity_id, status, applied_at, resume_document_id, cover_letter_id, apply_level (L0–L3), notes, next_action_at
- `application_events`: application_id, kind (`status_change|email|interview|note|reminder`), payload (JSON), occurred_at, origin (`user|gmail|system`)
- `generated_docs`: kind (`cover_letter|essay|short_answer|cold_email|follow_up`), application_id, prompt, inputs (JSON), body, cited_item_ids[], version
- `application_answers`: application_id, question, answer, answer_bank_id
- `contacts`: name, role (recruiter/PI/interviewer/referrer), email, linkedin, company_id
- `interviews`: application_id, round, scheduled_at, format, interviewers, questions, notes
- `offers`: application_id, compensation (JSON), decision_deadline, decision
- `emails`: gmail_message_id, thread_id, from, subject, received_at, classification, confidence, extracted (JSON), application_id, review_state
- `oauth_tokens`: provider, scopes, encrypted tokens

**Status rules** live in `packages/core` as an explicit state machine (allowed transitions, terminal states, auto-ghost rule).

---

## 11. Privacy & Security

- The vault holds sensitive personal data. Encrypt OAuth tokens and EEO answers at the application level; serve documents through short-lived signed URLs.
- Least-privilege Google scopes, requested only when a feature is turned on. "Disconnect Gmail" deletes tokens and all stored email metadata.
- Only send the AI the fields a task needs. EEO data never goes to the AI.
- One-click export of all data (JSON + files) and full account deletion.
- Polite crawling: identify ourselves with a user agent, rate-limit per host, cache responses, and only use public endpoints.
- The extension only runs on known application/job sites and only fills forms when the student clicks.

---

## 12. Milestones

Each phase produces something usable on its own.

**Phase 0: Foundation**
- Monorepo, Next.js, Drizzle + Postgres, Auth.js Google login.
- 1-bit pixel UI kit: buttons, inputs, cards, dialogs, tables, kanban columns, dither patterns, status badges, dark/invert mode.

**Phase 1: Tracker + Vault (MVP)**
- Profile vault CRUD + resume import (AI parse → confirm).
- Writing library + answer bank.
- Manual opportunity add (paste URL → parsed) and the full tracker: kanban, table, detail page, timeline, deadlines, reminders.

**Phase 2: Discovery**
- Adapter framework + Greenhouse, Lever, Ashby, SmartRecruiters adapters.
- Curated GitHub internship lists adapter.
- Company registry + ATS auto-detect + watchlist.
- Preferences, deduplication, fit scoring, Quest Board feed, "new opportunity" notifications.

**Phase 3: Forge (AI generation)**
- Cover letter pipeline with evidence citations and the claim checker.
- Essay + short answer generation from samples and the answer bank.
- Voice profile. PDF/DOCX export.
- Application packets (L1).

**Phase 4: Inbox Sync**
- Gmail OAuth, initial + incremental sync, classifier, matching, auto status updates, Review Inbox.
- Job alert email parsing (LinkedIn/Handshake/Indeed → feed).
- Optional Google Calendar sync for interviews and deadlines.

**Phase 5: Browser Extension**
- Clipper for LinkedIn/Handshake/Indeed/any posting.
- Autofill (L2) for Greenhouse, Lever, Ashby first, then Workday and iCIMS.
- Batch prepare (L3) queue.

**Phase 6: Research & Beyond**
- REU and research program lists, fellowships, scholarships with eligibility filtering.
- Faculty finder (OpenAlex + Semantic Scholar) and PI cold email generator.
- Big tech custom career-site adapters (Google, Microsoft, Amazon, Apple, Meta…).
- USAJobs / Adzuna adapters.

**Phase 7: Polish**
- Stats screen (funnel, response rates by source and resume version).
- Offer comparison, interview prep notes.
- Sound effects/sprite, keyboard shortcuts, onboarding flow ("create your character").
- Data export/delete, deploy.

---

## 13. Open Questions

1. **Who is it for?** Just you (single user, can run locally) or a product for many students (needs Google OAuth verification, multi-user hosting, costs)? The plan supports both but starts single-user.
2. **Hosting**: fully local (most private, free) vs. cloud (works from any device, needed for real-time Gmail push)?
3. **Automation level**: is L2 autofill (you click submit) enough, or do you want the optional unattended submit explored later despite the risks in §4?
4. **Email**: Gmail only, or also a school Outlook account?
5. **Fields**: CS/tech only at first, or also other majors (finance, consulting, bio, policy) whose sources differ?
6. **AI budget**: rough monthly limit for Claude API usage? This decides how aggressively fit re-ranking and packet generation run.
