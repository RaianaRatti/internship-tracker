# QUEST LOG

A 1-bit (pure black & white, pixel-font) tracker for internships, co-ops, research labs, fellowships, scholarships and every other student opportunity. Built from [PLAN.md](PLAN.md). Runs locally; your data stays in `data/quest.db`.

## Quick start

```bash
npm install
npm run dev            # creates the database + .env.local (APP_SECRET) on first run
open http://localhost:3000
```

Then:

1. **Character** → fill in your basics, or **Import resume** (needs a Claude key).
2. **Settings** → say what you're looking for (roles, seasons, locations) and mark dream/target companies.
3. **Quest Board** → **SYNC SOURCES** (first sync pulls ~8,000 postings in about a minute), then **+ TRACK** what you like.

Optional, in `.env.local` (see [.env.example](.env.example)):

| Variable | Turns on |
|---|---|
| `ANTHROPIC_API_KEY` | Essays, short answers, cold emails, resume import, AI re-ranking, smarter email sorting, parsing arbitrary posting pages (cover letters and resumes don't need it) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail sync (setup steps are on the Messenger page) |
| `OPENALEX_API_KEY` | Own daily budget for the faculty finder (works without it, sharing a small free budget) |

Background syncing: `npm run worker` (discovery every 6 h, Gmail every 10 min, ghost/follow-up checks). `npm run sync` runs everything once.

## What's where

| Screen | What it does |
|---|---|
| Home | Onboarding checklist, deadlines, reminders, new matches, pipeline, a companion sprite |
| Quest Board | Every discovered opportunity with fit score + reason, filters, AI re-rank |
| Quest Log | Kanban (drag or use the dropdown), table, offer comparison; each quest has a packet, timeline, interviews, offer, contacts |
| Character / Spellbook | Profile vault (every item has a citable id like `exp-3`), documents, EEO (encrypted, never sent to AI); **stories**, writing samples, voice profile, answer bank |
| Forge → Cover letter | **No AI needed.** Opens with one of your stories, connects its lesson to the role, ties 2–3 posting requirements to your real experience, and calls back to the story at the end. Different-wording button, story/tone switch, quality checks, .docx / PDF |
| Forge → Resume | **No AI needed.** One-page resume from your Character Sheet, optionally tailored to a quest (reorders by relevance, trims to fit), .docx / PDF, save as a resume version |
| Forge → AI writer | Essays, short answers, cold emails, follow-ups (needs a Claude key). Cites vault ids, flags unsupported claims |
| Research | OpenAlex faculty finder → track a PI + draft a cold email; curated REU / research / fellowship / scholarship lists with eligibility checks |
| Messenger | Gmail connect, sync, Review Inbox |
| Calendar / Stats | Month view + `.ics` feed; funnel, weekly applications, rates by source/type/resume version, time to first response |

Keyboard: `g` + key to jump (`g q` Quest Board, `g l` Log…), `/` search, `j`/`k` + Enter in lists, `a` add, `?` help.

## Sources

| Source | How |
|---|---|
| SimplifyJobs `Summer2027-Internships`, `New-Grad-Positions` | `listings.json` from GitHub (covers Microsoft, Meta, Apple, NVIDIA… too) |
| Greenhouse, Lever, Ashby, SmartRecruiters, Workday | Public board APIs, per company in the registry ([data/companies.yaml](data/companies.yaml), 77 verified boards; add more in Settings, which auto-detects the ATS) |
| Amazon, Google | Custom adapters for their careers sites |
| LinkedIn, Handshake, Indeed | **Not scraped.** Job-alert emails are parsed via Gmail sync, and the extension's clipper saves the page you're viewing |
| Research / fellowships / scholarships | [data/research_programs.yaml](data/research_programs.yaml), [fellowships.yaml](data/fellowships.yaml), [scholarships.yaml](data/scholarships.yaml) + OpenAlex |

## Browser extension (autofill + clipper)

1. `chrome://extensions` → Developer mode → **Load unpacked** → pick the [extension/](extension/) folder.
2. Open the extension's options and paste the token from **Settings → Browser extension**.
3. On an application page click the extension → **AUTOFILL**. It fills contact info, education, links, yes/no authorization questions, EEO (if saved), free-text questions from your packet/answer bank, the cover letter, and attaches your resume. Filled fields get a dashed outline. **It never submits.** After you submit, click **MARK APPLIED**.

Multi-page forms (Workday): run autofill again on each page.

## Development

```bash
npm test               # vitest: status machine, fit scoring, parsers, email rules, cover-letter rules
npm run typecheck
npm run db:generate    # after editing src/db/schema.ts
```

Stack: Next.js 16 (App Router, server actions) · SQLite via libSQL + Drizzle · Anthropic SDK (`claude-sonnet-5-5` for writing, `claude-haiku-4-5` for parsing/classifying; override with `QUEST_GEN_MODEL` / `QUEST_FAST_MODEL`) · plain MV3 extension.

### Where this differs from PLAN.md

- **SQLite instead of Postgres + pgvector, single Next.js app instead of a monorepo, no login.** The plan's open question #1 was single-user vs. multi-user; this build is single-user and local-first. Matching uses token overlap instead of embeddings.
- **Google Calendar** is an `.ics` feed instead of the Calendar API (no extra OAuth scope).
- **Gmail incremental sync** uses `after:<last sync>` queries instead of `history.list` / Pub/Sub push.
- **PDF export** is a clean print page (browser "Save as PDF") instead of a PDF library.
- **Microsoft / Meta / Apple** have no adapters (their career APIs block outside access); the SimplifyJobs lists cover them. **MLH hackathons** are a link, not a feed.
- Unattended auto-submit (plan §4 "possible later") is not built.
