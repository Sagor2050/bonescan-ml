# AGENTS.md

Instructions for AI coding agents (Claude Code, GitHub Copilot, Codex, Cursor,
and others) and for human contributors. This file explains what to build and
how to work on it. If this file and a maintainer's direct instruction disagree,
follow the maintainer and point out the conflict.

## Project overview

BoneScan is a CISC 3171 (Introduction to Software Engineering, Fall 2026) team
project by The White Coats. The requirements document and project plan call it
"3D Views for Medical Reports". The repository and the UI call it BoneScan.
Both names mean this app.

It is a desktop web app that shows patients where their bones are broken. The
patient adds a radiology report, the app picks out each fracture the report
describes, the patient confirms or corrects that list, and a 3D skeleton shows
each fracture on the right bone, side, and part of the bone. As follow-up
reports come in, the patient can step through them in exam-date order and
compare any two.

### Source of truth

Read the relevant parts of these before building a feature:

- [Requirements document v2](docs/requirements.pdf): scope, user stories with
  acceptance criteria, non-functional requirements, and Appendix A on how
  imaging reports are written.
- [Project plan v1.2](docs/project-plan.pdf): stack, architecture, key
  decisions, milestones, wireframes, and data schemas.

If the README or any other text disagrees with these two documents, follow the
documents and point out the conflict.

How to read the IDs in the docs:

| ID              | Meaning                                                    | Where                     |
| --------------- | ---------------------------------------------------------- | ------------------------- |
| `F1`–`F11`      | Features                                                   | Requirements section 4    |
| `S1.1`–`S11.2`  | User stories; their acceptance criteria define "done"      | Requirements section 5    |
| `NFR1`–`NFR12`  | Non-functional requirements                                | Requirements section 6    |
| `OQ1`–`OQ3`     | Open questions (OQ1 is answered)                           | Requirements section 7    |
| `FD1`–`FD9`     | Future directions. Don't build these.                      | Requirements section 8    |
| `M1`–`M6`       | Milestones                                                 | Project plan section 3    |

"Appendix" means something different in each document, so always say which
one you mean (for example "Requirements A.5" or "Plan B.2"):

- **Requirements Appendix A:** how reports are written. A.1 report sections,
  A.3 the 126 bones covered, A.4 directions and left/right, A.5 fracture words
  and named fractures, A.6 certainty and healing words, A.7 X-ray views.
- **Requirements Appendix B:** two fictional reports with their expected
  findings. They are the first acceptance tests.
- **Requirements Appendix C:** where the 3D model comes from.
- **Plan Appendix A:** wireframes for the six MVP screens.
- **Plan Appendix B:** data contracts. B.1 database tables, B.2 reader API,
  B.3 report lifecycle, B.4 `bones.json`.

### What the app is not

These are the easiest mistakes to make. Each one contradicts the requirements:

- **Not the patient's own bones.** The skeleton is a standard adult model.
  Never build a 3D model from X-rays, photos, or screenshots; a single X-ray
  has no depth (Requirements 2.2, A.2). Every view of the model says it is a
  standard skeleton (NFR5).
- **Not reading images.** Findings come only from the written report. Scan
  images never place, move, or remove a marker, and the app never detects
  fractures in images (Requirements 3.2).
- **No machine-written medical text.** No summaries, no AI-generated
  explanations, and no chat about terms. Every bone name, explanation, and
  status the app shows was written in advance and checked by a teammate
  (NFR6). This rules out LLMs anywhere in the product.
- **Fractures only.** Dislocations, arthritis, ligament tears, and soft tissue
  findings stay in the original report, unmarked.
- **Arms, legs, hands, feet, shoulders, and pelvis only:** the 126 bones
  (Requirements A.3). The skull, spine (including sacrum and tailbone), ribs,
  breastbone, and hyoid are not covered. A finding there is listed as outside
  coverage and gets no marker (S2.4).
- **Adult skeleton, English reports, patients as users.** No children's
  skeleton, other languages, or features for healthcare professionals.
- **Desktop browsers only:** current Chrome, Safari, Firefox, and Edge. No
  phone or tablet layout yet.

### MVP scope

The MVP is the P1 features, F1 to F6. Each story has its own GitHub issue:

| Feature                      | Stories   | Issues  |
| ---------------------------- | --------- | ------- |
| F1 Adding a report           | S1.1–S1.3 | #4–#6   |
| F2 Checking the findings     | S2.1–S2.4 | #7–#10  |
| F3 The 3D skeleton           | S3.1–S3.3 | #11–#13 |
| F4 Report and model together | S4.1–S4.2 | #14–#15 |
| F5 Recovery timeline         | S5.1–S5.3 | #16–#18 |
| F6 Accounts                  | S6.1–S6.3 | #19–#21 |

The P2 features wait until every P1 feature is done, and then come in this
order: F7 scan images, F8 pictures of reports, F9 term explanations, F10
sharing, F11 guest mode. S7.3 (sorting by date or bone) is out of the plan.
Don't build P2 features unless the team asks.

The schedule is six weeks. The findings format is fixed at the end of week 1,
features freeze at the end of week 5, and week 6 is only for testing and the
demo.

## Product rules

These come from the project plan's key decisions and the requirements. Follow
them in every feature.

**The report**

- Store the PDF or pasted text exactly as added. Never edit it. Findings,
  highlights, and labels live in their own tables and are drawn on top
  (NFR4).
- Every finding keeps the exact report wording it came from and its position
  on the page (S2.1, S4.2).
- Draw a marker only for a finding the patient has confirmed or entered
  themselves (S2.3). Label patient-entered or changed findings as entered by
  the patient wherever they appear.
- Take the exam date from the Exam line or the report header, never from the
  Comparison section. It can't be in the future. If the report has no date,
  or several dates, the patient enters it (S1.2).

**The reader**

- It uses rules, not AI. It matches the report against `bones.json` and the
  word lists in Requirements Appendix A, and medspaCy handles sections,
  negation, and uncertainty. The same report always gives the same findings,
  and no report is ever sent to an outside AI service.
- It keeps nothing. It takes a report, returns the text and proposed
  findings, and forgets it. Only Supabase stores reports, so deletion happens
  in one place (NFR10).
- Only the Findings and Impression sections produce findings. History,
  Indication, Comparison, and Technique never do (Requirements A.1). A report
  with no section headings is read as all findings.
- A fracture described in both Findings and Impression is one finding, not
  two (S2.1).
- "No fracture", "negative for fracture", and "no acute fracture" create no
  finding. "Possible", "probable", "suspected", "questionable", and "cannot be
  excluded" create a finding marked uncertain (S2.2, Requirements A.6).
- The side comes from the sentence. If the sentence has none, it comes from
  the Exam line, but only if that line names exactly one side. Otherwise the
  finding is "side not stated" and gets no marker until the patient sets it
  (S2.1, S2.4).
- When a rule misses a case, add that case as a test.

**The skeleton**

- `web/public/shared/bones.json` is the one bone catalog. It lists each of the
  126 bones once. Each entry's `id` is also the mesh name in
  `web/public/shared/models/skeleton.glb`: the bone, then the finger or toe
  number where needed, then the side, as in `radius_left`,
  `metacarpal_5_right`, or `proximal_phalanx_hand_1_left`. Each entry also
  has the medical and everyday names, the words reports use (such as
  `radial`), and a marker point for each part. The reader, the skeleton, and
  the correction menus all read this file. Never hard-code bone names or bone
  lists anywhere else.
- Left and right always mean the patient's own. In model coordinates the
  patient's left is +X, so in a front view a left-side fracture appears on
  the viewer's right. Getting this backwards puts every marker on the
  mirror-image bone (Requirements A.4).
- When a finding names a part of the bone, put the marker on that part's
  point. When it doesn't, highlight the whole bone (S3.1).
- Certain and uncertain findings use different marker shapes and labels.
  Never show any information by color alone (S3.1, NFR12).
- Marker labels give the medical and everyday name, as in "radius (forearm
  bone, thumb side)" (S3.1).

**The timeline**

- Order reports by exam date, oldest first. Reports with the same exam date
  keep the order they were added (S5.1).
- Healing status comes only from the report's own healing words, shown in
  those words (Requirements A.6). Never work it out from the time that has
  passed (S5.3).
- One function, `sameInjury`, decides whether findings in two reports are the
  same injury. Until OQ3 is decided, it means same bone and same side. Don't
  change the rule without the team.

## Architecture

This is the design from the project plan. Much of it isn't built yet, so check
the code for what exists. The app has three parts:

- **Web app** (`web/`): runs in the patient's browser and does everything the
  patient sees. PDF.js shows the original PDF with highlight boxes drawn over
  it, and React Three Fiber draws the skeleton. A Workspace Controller owns
  the confirmation gate, the one selected finding that the report pane and
  the skeleton both follow, and the timeline and comparison state.
- **Report reader** (`reader/`): a small FastAPI service. `POST /read` takes a
  PDF or pasted text and returns the extracted text, the exam date (or
  candidate dates), and the proposed findings. It refuses files that are not
  PDFs (`not_pdf`), over 10 MB (`too_large`), over 10 pages
  (`too_many_pages`), or have no readable text (`no_text`). It accepts
  requests only from our site with a signed-in user's token. `GET /health`
  wakes it on Render's free tier.
- **Supabase:** accounts (email and password only, with a confirmed email),
  a Postgres database with row-level security on every table, and file
  storage at `{user_id}/{report_id}.pdf`. A row or file is visible only to the
  account that owns it (NFR8).

A report moves through these states: Added, then Reading (at the reader),
then Unconfirmed (in the browser only), then Confirmed (saved to Supabase).
Nothing is saved until the patient confirms. A report that fails the file
checks is Refused, and nothing is saved (Plan B.3).

The database has two tables (Plan B.1):

- `reports`: `id`, `user_id`, `source` (PDF or pasted), `file_path`,
  `raw_text` (never edited), `exam_date`, `exam_date_source` (report or
  patient), `added_at`.
- `findings`: `id`, `report_id`, `bone` (a `bones.json` bone without the
  side, such as `radius` or `metacarpal_5`), `side` (`left`, `right`, or
  empty), `part` (list), `type_words` (list), `certainty` (`certain` or
  `uncertain`), `healing_words` (list), `status` (`placed`,
  `outside_coverage`, `side_not_stated`, or `bone_not_stated`), `wording`
  (each piece of report wording with its position), and
  `entered_by_patient`.

The reader returns findings with these same fields, minus `id` and
`report_id`. This contract is fixed at the end of week 1 (Plan B.2). Changing
it needs agreement from both the web app and the reader sides.

Targets to keep in mind:

- Findings ready within 10 seconds for a 10-page report (NFR1). The model and
  every marker appear within 5 seconds of confirming (NFR2).
- Turning the model holds 30 frames per second on a laptop with built-in
  graphics made in 2020 or later (NFR3). The model stays under 250,000
  triangles and the `.glb` under 5 MB.
- On the held-back test reports, the reader finds at least 90% of fractures
  with the right bone and side, and no more than 5% of its findings name a
  bone or side the report doesn't (NFR7).
- Patients give nothing but an email address and password (NFR8).

## Scope boundary: explain, never diagnose

The app explains what a report **says** and where it **points**. It never
judges whether healing is going well, never gives a prognosis, and never
recommends treatment. Those decisions belong to the patient's care team, and
the app sends patients back to them.

When writing features and UI copy:

- Never produce a clinical verdict ("your fracture is healing normally",
  "this looks worse"), a prognosis, or treatment advice.
- Keep a visible path back to the care team wherever interpreted content
  appears.
- When a term or location can't be mapped with confidence, say so. Don't
  guess. A finding that can't be placed is listed with its reason and gets no
  marker (S2.4).
- Write patient-facing text in plain language, aiming for a 6th–8th grade
  reading level. Term explanations are at most two sentences and score at or
  below grade 8 on the Flesch-Kincaid scale (S9.1).
- Features that generate or display interpreted text need tests showing they
  stay inside this boundary.

## Health data and privacy

Treat all imaging and report data as protected health information (PHI), even
during development.

- Never commit real patient data. Use synthetic data or public de-identified
  datasets only, and record each dataset's source and license next to it.
- Never paste real patient data into AI assistants, issue trackers, chat, or
  any other external service.
- The reader's test set of de-identified real reports (OQ1) lives in a private
  folder, never in this repository, the deployed app, or a test fixture. Use
  the fictional reports in Requirements Appendix B for tests and demos.
- Don't log report text, images, or patient identifiers. medspaCy's sentence
  splitter (PyRuSH) logs every token at DEBUG level through loguru, so turn
  that off before the reader handles report text.
- Keep secrets (API keys, tokens, credentials) out of the repo. Read them from
  environment variables, and commit a `.env.example` with placeholder values
  instead of a real `.env`.
- `.gitignore` blocks common medical imaging formats and the root `data/`
  directory. Put synthetic test fixtures under `tests/fixtures/`, which is
  exempt. Never use `git add -f` to get around these rules.

## Tech stack and commands

The stack comes from the [project plan](docs/project-plan.pdf). The repository
holds two projects:

- `web/`: the web app. React and TypeScript built with Vite, Three.js through
  React Three Fiber and drei for the 3D skeleton, PDF.js for the original
  report, and supabase-js for accounts and storage. Tested with Vitest and
  Playwright, linted with oxlint. Needs Node 24 (`web/.nvmrc`).
- `reader/`: the report reader. A FastAPI service in Python 3.11 that uses
  pdfplumber and medspaCy. Tested with pytest.

Don't add a language, framework, package manager, dependency, build tool, or
CI workflow outside this stack without team agreement. Propose it in an issue
first.

Run each command from inside its project folder:

| Task                 | `web/`                                            | `reader/`                                                                       |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| Install dependencies | `npm ci`, then `npx playwright install chromium` | `python3.11 -m venv .venv`, then `.venv/bin/pip install -r requirements-dev.txt` |
| Run the app          | `npm run dev`                                     | `.venv/bin/uvicorn app.main:app --reload`                                       |
| Run tests            | `npm test` and `npm run test:e2e`                 | `.venv/bin/pytest`                                                              |
| Lint                 | `npm run lint`                                    | None yet                                                                        |
| Type-check and build | `npm run build`                                   | Not needed                                                                      |
| Check the 3D model   | `npm run check:model`                             | Not needed                                                                      |

On Windows, use `.venv\Scripts\` instead of `.venv/bin/`.

Always run code and tests inside the project's own environment and lockfile
(`web/package-lock.json` and `reader/.venv`). Never install packages globally.

## Development workflow

1. **Start from an issue.** Open or pick one for any substantive change so
   the work is on record.
2. **Branch from an up-to-date `main`.** Name branches
   `<type>/<issue>-<short-description>`, for example `feat/12-term-glossary`.
3. **Keep changes small and focused.** One logical change per pull request.
   Don't mix refactors, reformatting, or unrelated fixes into feature work.
4. **Open a pull request** into `main` and fill in the template. Never push
   directly to `main`.
5. **Get a review.** At least one teammate approves before merge. Expect
   feedback, address it, and reply to each comment. Checks must pass once CI
   exists.
6. **Merge as a single commit** when possible (see below), then delete the
   branch.

### Squashing and updating a branch

To combine local commits before opening or updating a pull request:

```sh
git rebase -i HEAD~N                     # humans: squash or reorder interactively
git reset --soft HEAD~N && git commit    # agents without an interactive editor
git push --force-with-lease              # update the remote after rewriting history
```

To pick up new changes from `main`, rebase instead of merging:
`git fetch origin && git rebase origin/main`.

Only rewrite history on your own feature branch. Never use plain `--force`,
and never force-push `main` or a branch someone else is working on.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```text
<type>(<scope>): <subject>

<body: what changed and why, wrapped at 72 characters>

Closes #123
Co-authored-by: <tool or model used, if any>
```

- **Type**: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `style`,
  `build`, `ci`, or `chore`.
- **Scope** (optional): the area touched. Suggested scopes are `report`,
  `glossary`, `viewer`, `timeline`, `ingest`, `data`, `ui`, `docs`, `ci`, and
  `repo`. Add new ones as the codebase grows, and reuse existing ones.
- **Subject**: imperative mood, lowercase, no trailing period, 72 characters
  or fewer. Example:
  `feat(glossary): add plain-language definitions for fracture types`.
- **Body**: explain *why*, not just *what*. Optional for trivial changes.
- **Issues**: if the work addresses an issue, close it with a GitHub keyword
  in the footer (`Closes #123` or `Fixes #123`). The issue closes when the
  commit lands on `main`.
- **Breaking changes**: add `!` after the type or scope, plus a
  `BREAKING CHANGE:` footer.

Pull request titles use the same format, because a squash merge uses the title
as the commit subject.

## Code and documentation

- Write clear, readable code and documentation. Clarity beats cleverness.
- Prefer simple, well-scoped changes over large rewrites.
- Match the style of the surrounding code. Don't reformat files you aren't
  otherwise changing.
- Behavior changes come with tests. Bug fixes come with a test that would have
  caught the bug.
- Update docs (README, this file, comments) in the same pull request as the
  change they describe.
- Don't leave commented-out code, debug output, or TODOs without a linked
  issue.

## Disclosure of AI use

If AI tools helped write code, docs, or tests, add a `Co-authored-by` trailer
to the commit for each tool, naming the tool or model actually used:

```text
Co-authored-by: GitHub Copilot
Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>
```

Whoever opens the pull request is responsible for any AI-assisted work in it.
Read it, understand it, and be ready to explain it in review. The trailer adds
to any course policy on AI use. It does not replace one.

## Rules for AI agents

**Always**

- Follow this file, especially the product rules, the scope boundary, and the
  data rules.
- Before building a story, read its acceptance criteria in the requirements
  document and the matching milestone in the project plan. Name the story
  (for example S2.2) in the pull request.
- Read the relevant code before changing it, and limit edits to what the task
  needs.
- Run the project's tests and linters before proposing a commit (once they
  exist), and report failures as they are.
- Add the AI disclosure trailer to commits you write.

**Ask first**

- Adding or changing dependencies, languages, frameworks, or tooling.
- Changing CI, repository settings, or the rules in this file.
- Deleting files or rewriting history that others may have pulled.
- Anything that changes how patient data is stored, sent, or displayed.
- Pushing branches or opening pull requests.

**Never**

- Commit real patient data, credentials, or secrets.
- Write clinical verdicts, prognoses, or treatment advice into code or copy.
- Add an LLM or any other AI text generation to the product, or send report
  text to an outside AI service (NFR6).
- Build anything listed under "What the app is not" or under Future
  Directions (FD1–FD9) unless the team asks.
- Push to `main`, force-push shared branches, or skip hooks and checks
  (`--no-verify`).
- Invent medical facts. If a definition or mapping isn't backed by a source,
  flag it for human review.
