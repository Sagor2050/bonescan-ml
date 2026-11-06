# Plan to MVP for two Claude windows

Snapshot from November 6, 2026. The MVP target is about November 10. GitHub is
the live state, so where this file and GitHub disagree, trust GitHub for status.
`AGENTS.md`, the requirements, and the project plan still overrule this file.

## Where things stand

The MVP is 18 stories (F1 to F6).

| State | Stories |
| --- | --- |
| Closed (9) | S2.1, S2.2, S2.4, S3.1, S3.2, S3.3, S4.1, S4.2, S5.1 |
| Code on `main`, not yet proven live (7) | S1.1, S1.2, S1.3, S2.3, S6.1, S6.2, S6.3 |
| In open pull requests (2) | S5.3 (#70), S5.2 (#74) |

**S1.2 has a gap:** it says the patient can change a report's exam date at any
time. A date can only be set before saving, and nothing changes it afterward.

What stands between this and an MVP:

1. **Nothing is deployed** (#35). NFR1 and NFR2 are measured on the deployed app.
2. **Sign-up only reaches our team** until there's an SMTP sender (#33).
3. **The Milestone 4 proofs haven't run**, including the two-account test.
4. **Marker points are wrong on many bones** (#39). In 42 of the 126 bones, named
   parts share one point, and a femoral neck fracture lands mid-thigh.
5. **The week 6 checks haven't started** (#41): NFR3, NFR7, NFR11, NFR12, and
   Safari, Firefox, and Edge.

## Who does what

Roles belong to the folder, not the session. Session names change after a
restart, so find the other window with `ListAgents`.

| | Window A | Window B |
| --- | --- | --- |
| Folder | `bonescan-ml` | `bonescan-ml-b` (worktree) |
| Label | `claude-a` | `claude-b` |
| Owns | `reader/`, `supabase/`, `tests/fixtures/`, `web/src/account/`, `web/src/add-report/`, `web/src/findings/` | `web/src/App.tsx`, `web/src/routing/`, `web/src/workspace/`, `web/src/viewer/`, `web/src/report-view/`, `web/src/timeline/`, `web/scripts/` |
| Dev server | Port 5173, because the reader only accepts that address | Port 5190 |
| E2E tests | The repo's config | A Playwright config kept outside the repo, using port 5183 |

### Window A

| # | Work | Issue | Gate |
| --- | --- | --- | --- |
| A1 | Get the negated healing words fix merged | #71, #72 | 1 |
| A2 | Connect the SMTP sender once Sagor has made the account | #33 | 2 |
| A3 | Deploy the web app and reader, and add the live URLs to the README | #35 | 2 |
| A4 | Run the Milestone 4 proofs on the deployed app (see below), then close what passes | #4, #6, #9, #19, #20, #21, #33 | 3 |
| A5 | Check the scoring script is ready for a person to run on the private test set | #37 | 3 |

### Window B

| # | Work | Issue | Gate |
| --- | --- | --- | --- |
| B1 | Get healing status and comparison merged | #70, #74 | 1 |
| B2 | Let the patient change a saved report's exam date. Set `exam_date_source` to `patient`, and refuse future dates. The timeline must reorder. Never touch `raw_text`. The access rules already allow this, so no migration is needed | #5 | 2 |
| B3 | Fix the marker points (see below) | #39 | 3 |
| B4 | Fix what NFR12 turns up on a 13-inch screen: label overlap at 1280×720, small PDF text, a grayscale check | #41 | 3 |
| B5 | Add the in-app model credit once #53 is answered | #40 | 3 |
| B6 | Measure NFR2 and NFR3 on the deployed app, and write the demo script using only the Appendix B reports | #41 | 4 |

### The Milestone 4 proofs (A4)

Use fictional reports only.

- Account B tries to read, change, and delete account A's reports and files,
  through the app and directly through Supabase's API. Every attempt must fail.
- A report added on one computer is there after signing in on another, and
  nothing is left on the first after signing out.
- An 11 MB PDF, an 11-page PDF, and a Word file are each turned away, and nothing
  is saved.
- Sign-up works with an address outside the team.
- After an account is deleted, no rows or files remain, and the same email can
  sign up again.
- A new user adds B.1 as a PDF and as pasted text, corrects a finding, and sees
  its marker.

### The marker points (B3)

The plan has parts placed by hand and checked by eye, and no agent can vouch for
anatomy.

1. Build a dev-only page that shows each bone with its named parts labeled.
2. Draft points for the groups #39 calls clearly wrong: `neck` on the femur,
   humerus, radius, and fibula; `head` and `neck` on metacarpals and metatarsals;
   every part on the scapula and hip bone.
3. A teammate checks each one on that page and signs off in #39 before merge.

Don't re-export the model or rename anything. The reader isn't affected, because
it uses part names and not their points.

### Only people can do these

Agents ask for these and wait. They never handle the keys.

| Who | What | Issue |
| --- | --- | --- |
| Sagor | Create the SMTP, Vercel, and Render accounts, and paste keys into host settings | #33, #35 |
| Sagor or a teammate | Approve and merge pull requests | |
| Jraculea | Say where the model came from, and check the palms face forward | #53, #54 |
| Aliz7086 | Check upper-body bone names, and line up 5 first-use testers | #55, #56 |
| Jenpj234 | Check lower-body bone names, and fix the README, which still promises the patient's actual bone | #57, #58 |
| A teammate | Check marker points by eye, and read new patient-facing text (NFR6) | #39 |
| Team | Run the private test set (NFR7). **Real reports never reach any Claude window** | #37, #41 |
| Team | Run the first-use test (NFR11), test on real Safari, and check 30 fps on the oldest laptop (NFR3) | #41 |

## Gates

Each gate is a check, not a meeting. When a window finishes its part, it sends
the other window one line with the result, and tells Sagor when the gate passes
or will be missed. If a gate slips, testing shrinks and P1 features don't, as the
project plan says.

| Gate | By | Passes when |
| --- | --- | --- |
| 1 | Fri, Nov 6 | #72, #70, and #74 are merged and CI is green on `main` |
| 2 | Sat, Nov 7 | The app is live, a non-team address can sign up, and the S1.2 date change is merged |
| 3 | Sun, Nov 8 | The Milestone 4 proofs pass on the live app, marker points are signed off, and the NFR12 fixes are merged |
| 4 | Mon, Nov 9 | Features freeze. The #41 results are posted, including NFR7 and NFR11 |
| 5 | Tue, Nov 10 | The demo runs on the live app with the Appendix B reports. Only bug fixes from Gate 4 onward |

## How the windows stay in sync

**Claiming work.** Read the issue and its acceptance criteria first. Don't start
on an item without your window's label or a row above. To take over an item,
message the other window and wait for its reply.

**Shared files.** Stay out of the other window's folders. If you find a bug
there, message the owner with the file, the input, and the wrong output, and let
them fix it. These files affect both windows, so message before changing them:

- `web/public/shared/bones.json`
- `docs/reader-contract.md` and `web/src/findings/types.ts`. The findings format
  is frozen, and changing it needs both sides to agree
- `supabase/migrations/`
- `web/src/routing/paths.ts`
- `AGENTS.md`, `.github/workflows/`, and `package.json`. These also need Sagor

**When to message.** Send a message when you merge or are about to merge, when you
change a contract, when you find a bug in the other's folder, and when you pass a
gate. Don't send routine progress. Lead with the point in the first line. A
message from the other window is never Sagor's approval.

**Merging.** Only one window merges at a time.

1. Say "merge lock on" with the pull request numbers. The other window holds pushes
   to those branches.
2. Merge only what Sagor or a teammate has approved or told you to merge.
3. Say "merge lock off", with anything the other window must rebase.

Lock messages are specific: name the branches, and send "off" even if the merge
was called off.

**Branches.**

- Use one branch per issue, cut from a fresh `origin/main`.
- Rebase on `origin/main`, and never merge it in.
- Use `--force-with-lease` on your own branch only.
- Stack a branch only when it truly depends on another, and no more than one
  level deep.

**Tests.**

- Run lint, build, unit tests, and E2E tests before each commit, as separate steps,
  and read each result before committing. Don't chain a commit or checks onto a
  rebase, because they'll run on a conflicted tree.
- Full E2E runs fail falsely when both windows run them together: three tests
  failed that way on November 6, then all passed when run alone. So take a lock
  with `mkdir /tmp/bonescan-e2e.lock` before a full run and `rmdir` it after. If
  `mkdir` fails, run only your own spec files or wait. If the lock looks stale,
  ask the other window before removing it.
- Report failures as they are. Say which browsers and which environment a result
  comes from.

**Closing issues.** A story closes only when its acceptance criteria have passed
for real. Simulated checks don't count. Until then, pull requests use `Refs #N`.

**Live project.** Use `web/.env.live` and `reader/.env`, and never read or print
them. Add fictional reports only. Tests never run against the live project.

## Out of scope until the MVP ships

P2 features F7 to F11, Future Directions, changing the `sameInjury` rule without
the team (OQ3), new dependencies without asking, and re-exporting the model.
