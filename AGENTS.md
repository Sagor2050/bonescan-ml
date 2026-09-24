# AGENTS.md

Instructions for AI coding agents (Claude Code, GitHub Copilot, Codex, Cursor,
and others) and for human contributors. The [README](README.md) explains what
BoneScan is. This file explains how to work on it. If this file and a
maintainer's direct instruction disagree, follow the maintainer and point out
the conflict.

## Project overview

BoneScan is a CISC 3171 (Introduction to Software Engineering, Fall 2026) team
project that helps patients understand their own imaging reports. It will:

- Show the patient's actual bone in interactive 3D, with the spot the
  radiology report describes marked on it.
- Translate report language (e.g. "nondisplaced", "comminuted", "interval
  callus formation") into plain language, and answer questions about any term.
- Order scans on a timeline so a patient can compare week two with week six.

## Scope boundary: explain, never diagnose

The app explains what a report **says** and where it **points**. It never
judges whether healing is going well, never gives a prognosis, and never
recommends treatment. Those decisions belong to the patient's care team, and
the app sends patients back to them.

When writing features, prompts, and UI copy:

- Never produce a clinical verdict ("your fracture is healing normally",
  "this looks worse"), a prognosis, or treatment advice.
- Keep a visible path back to the care team wherever interpreted content
  appears.
- When a term or location can't be mapped with confidence, say so. Don't
  guess.
- Write patient-facing text in plain language, aiming for a 6th–8th grade
  reading level.
- Features that generate or display interpreted text need tests showing they
  stay inside this boundary.

## Health data and privacy

Treat all imaging and report data as protected health information (PHI), even
during development.

- Never commit real patient data. Use synthetic data or public de-identified
  datasets only, and record each dataset's source and license next to it.
- Never paste real patient data into AI assistants, issue trackers, chat, or
  any other external service.
- Don't log report text, images, or patient identifiers.
- Keep secrets (API keys, tokens, credentials) out of the repo. Read them from
  environment variables, and commit a `.env.example` with placeholder values
  instead of a real `.env`.
- `.gitignore` blocks common medical imaging formats and the root `data/`
  directory. Put synthetic test fixtures under `tests/fixtures/`, which is
  exempt. Never use `git add -f` to get around these rules.

## Tech stack and commands

The team hasn't chosen a stack yet. Until this section is updated:

- Don't add a language, framework, package manager, dependency, build tool,
  or CI workflow without team agreement. Propose it in an issue first.
- Don't scaffold application code ahead of that decision.

Once the stack is chosen, record it here with exact commands:

| Task                 | Command |
| -------------------- | ------- |
| Install dependencies | _TBD_   |
| Run the app          | _TBD_   |
| Run tests            | _TBD_   |
| Lint and format      | _TBD_   |

Always run code and tests inside the project's own environment and lockfile
(for example a virtual environment or `package-lock.json`). Never install
packages globally.

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

- Follow this file, especially the scope boundary and the data rules.
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
- Write clinical verdicts, prognoses, or treatment advice into code, copy, or
  prompts.
- Push to `main`, force-push shared branches, or skip hooks and checks
  (`--no-verify`).
- Invent medical facts. If a definition or mapping isn't backed by a source,
  flag it for human review.
