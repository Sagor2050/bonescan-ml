# BoneScan

BoneScan helps patients understand what their imaging reports say. It shows a
standard adult skeleton with confirmed fractures marked on the bones, alongside
the original report exactly as written.

> **Status:** The [web app](https://bonescan-ml.vercel.app/) is live, and the
> [report reader](https://bonescan-ml.onrender.com/health) is deployed. The
> first deployment is tracked in
> [issue #35](https://github.com/Sagor2050/bonescan-ml/issues/35).

BoneScan is a team project for CISC 3171: Introduction to Software Engineering
(Fall 2026, instructor Alec Malstrom), based on a pitch by Sagor Sutra Dhor.

## The problem

Radiology reports are written by doctors, for doctors. A patient recovering
from a fracture sees terms like *nondisplaced*, *comminuted*, and *interval
callus formation* in their patient portal, often days before they can ask
anyone what those words mean. They can't tell whether they just read good news
or bad news.

The idea came from Sagor's mother, who fractured her fibula and received six
reports over several weeks. Sagor spent hours working out what the terminology
meant and where on her leg it pointed, in order to explain her own body back to
her. Most people don't have someone to do that for them. Patients can open
their records now, but being able to open a report doesn't mean they can
understand it.

## Planned features

- **A standard skeleton, in 3D.** See fractures described in the report
  marked on the corresponding bones of a standard adult skeleton.
- **The original report.** Read it as written, then confirm or correct the
  proposed fracture findings.
- **A timeline of reports.** See reports in order and compare two reports on
  one skeleton.

## What BoneScan does not do

BoneScan explains what a report says and where it points. It never judges
whether healing is going well, never gives a prognosis, and never recommends
treatment. Those decisions belong to the patient's care team, and the app
sends patients back to them.

## Who it's for

- **Patients** recovering from injuries like fractures, which take months to
  heal and produce a long trail of reports.

## Why existing options fall short

| Option                   | What it gets right       | What it's missing                                          |
| ------------------------ | ------------------------ | ---------------------------------------------------------- |
| Patient portals          | Access to the raw report | No images, no explanation, no history                      |
| Searching online         | Fast                     | Shows someone else's injury, often the worst version of it |
| Printed diagrams         | A static reference       | Not linked to the report or its fracture findings          |
| The doctor's appointment | The real answer          | Fifteen minutes, days after the report, and nothing to take home |

## Project documents

- [Requirements document](docs/requirements.pdf): scope, user stories, and
  non-functional requirements (version 2).
- [Project plan](docs/project-plan.pdf): stack, architecture, milestones,
  and risks (version 1.2).

## Data and privacy

This repository never contains real patient data. Development uses synthetic
data or public, de-identified datasets only. See
[AGENTS.md](AGENTS.md#health-data-and-privacy) for the rules.

## Getting started

You need [Node 24](https://nodejs.org/) and
[Python 3.11](https://www.python.org/downloads/).

```sh
# Web app, at http://localhost:5173
cd web
npm ci
npx playwright install chromium   # browser for the end-to-end tests
npm run dev

# Report reader, at http://localhost:8000/health (in a second terminal)
cd reader
python3.11 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --reload
```

On Windows, use `.venv\Scripts\` instead of `.venv/bin/`. Test and lint
commands are in [AGENTS.md](AGENTS.md#tech-stack-and-commands).

This runs the app without accounts. To connect it to the team's Supabase
project, follow the [teammate setup guide](docs/teammate-setup.md).

## Contributing

Every contributor, human or AI, follows [AGENTS.md](AGENTS.md). In short, every
change goes through a pull request, commits use the Conventional Commits
format, a teammate reviews before merge, and AI assistance is disclosed.

## Disclaimer

BoneScan is a student project. It is not a medical device and does not provide
medical advice. Talk to your care team about your health.
