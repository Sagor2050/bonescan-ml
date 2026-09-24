# BoneScan

BoneScan helps patients understand their own imaging reports. It shows the
patient's actual bone in 3D with the reported spot marked, translates report
language into plain English, and lines up scans over time so a patient can see
their recovery for themselves.

> **Status:** Early planning. The team has not chosen a tech stack yet, and
> there is no application code.

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

- **Your bone, in 3D.** See your actual bone in an interactive 3D view, with
  the spot the report describes marked on it.
- **Reports in plain language.** Read the report in everyday words, and ask
  about any term to get a plain answer.
- **A timeline of scans.** See every scan in order, and compare week two with
  week six side by side.

## What BoneScan does not do

BoneScan explains what a report says and where it points. It never judges
whether healing is going well, never gives a prognosis, and never recommends
treatment. Those decisions belong to the patient's care team, and the app
sends patients back to them.

## Who it's for

- **Patients** recovering from injuries like fractures, which take months to
  heal and produce a long trail of reports.
- **Families and caregivers** who end up interpreting those reports for
  someone they care for.
- **Surgeons and physician assistants**, who spend appointment minutes
  sketching on paper or pointing at generic models to rebuild context the
  patient could already have.

## Why existing options fall short

| Option                   | What it gets right       | What it's missing                                          |
| ------------------------ | ------------------------ | ---------------------------------------------------------- |
| Patient portals          | Access to the raw report | No images, no explanation, no history                      |
| Searching online         | Fast                     | Shows someone else's injury, often the worst version of it |
| Printed diagrams         | A picture of the bone    | Not *your* bone, and not how it looked six weeks in        |
| The doctor's appointment | The real answer          | Fifteen minutes, days after the report, and nothing to take home |

## Data and privacy

This repository never contains real patient data. Development uses synthetic
data or public, de-identified datasets only. See
[AGENTS.md](AGENTS.md#health-data-and-privacy) for the rules.

## Getting started

Setup instructions will be added once the team chooses a tech stack.

## Contributing

Every contributor, human or AI, follows [AGENTS.md](AGENTS.md). In short, every
change goes through a pull request, commits use the Conventional Commits
format, a teammate reviews before merge, and AI assistance is disclosed.

## Disclaimer

BoneScan is a student project. It is not a medical device and does not provide
medical advice. Talk to your care team about your health.
