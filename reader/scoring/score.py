"""Score the reader on a folder of reports (NFR1, NFR7).

The reports stay in the private test-set folder. They never go in this repo, and
nor does anything this script reads. It prints only numbers and file names, never
report text, so its output is safe to share.

    .venv/bin/python -m scoring.score /path/to/private/folder

Put each report beside an answer key with the same name:

    wrist-01.pdf (or wrist-01.txt)
    wrist-01.json

An answer key lists the report's fractures. An empty list means there are none:

    {"fractures": [{"bone": "radius", "side": "left"}]}

`bone` is a bone from bones.json without the side. `side` is left, right, or empty
if the report doesn't state one. Fractures outside coverage aren't listed.

File names are printed, so use names like wrist-01 and never a person's name. A
report with no key, a key with a mistake, or a report the reader fails on is listed
as a problem, and the run can't pass until it's fixed. Keep the folder outside this
repo, and share only what this prints.
"""

import argparse
import json
import sys
import time
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from app.contract import ReadResponse
from app.main import read_pasted, read_pdf
from app.pdf import ReportRefused
from app.reading import _catalog

FOUND_TARGET = 0.90
WRONG_TARGET = 0.05
SECONDS_TARGET = 10.0
REPORT_SUFFIXES = (".pdf", ".txt")
SIDES = ("left", "right", "")


class KeyProblem(Exception):
    """An answer key can't be used. The message never quotes the key or a report."""


@dataclass
class Score:
    reports: int = 0
    refused: int = 0
    stated: int = 0
    found: int = 0
    findings: int = 0
    wrong: int = 0
    slowest: float = 0.0
    problems: int = 0

    @property
    def found_share(self) -> float:
        return self.found / self.stated if self.stated else 1.0

    @property
    def wrong_share(self) -> float:
        return self.wrong / self.findings if self.findings else 0.0

    @property
    def passes(self) -> bool:
        return (
            self.reports > 0
            and self.problems == 0
            and self.found_share >= FOUND_TARGET
            and self.wrong_share <= WRONG_TARGET
            and self.slowest < SECONDS_TARGET
        )


def load_key(path: Path) -> dict:
    """Read an answer key, so a mistake in it isn't scored against the reader."""
    try:
        key = json.loads(path.read_text())
    except (OSError, ValueError) as error:
        raise KeyProblem("it isn't valid JSON") from error
    fractures = key.get("fractures") if isinstance(key, dict) else None
    if not isinstance(fractures, list):
        raise KeyProblem('it has no "fractures" list')
    for number, fracture in enumerate(fractures, start=1):
        if not isinstance(fracture, dict) or not {"bone", "side"} <= fracture.keys():
            raise KeyProblem(f'fracture {number} needs a "bone" and a "side"')
        if fracture["bone"] not in _catalog():
            raise KeyProblem(f"fracture {number} has a bone that isn't in bones.json")
        if fracture["side"] not in SIDES:
            raise KeyProblem(f'fracture {number} has a side other than left, right, or ""')
    return key


def compare(response: ReadResponse, key: dict) -> tuple[int, int, int, int]:
    """Count (stated, found, findings, wrong) for one report.

    A finding counts as naming a bone or side the report doesn't when it's placed
    on a bone and side the key doesn't list. Findings the reader couldn't place
    name neither, so they count as misses but not as wrong.
    """
    expected = Counter((f["bone"], f["side"]) for f in key["fractures"])
    placed = Counter(
        (f.bone, f.side)
        for f in response.findings
        if f.status in ("placed", "side_not_stated")
    )
    found = sum((expected & placed).values())
    wrong = sum((placed - expected).values())
    return sum(expected.values()), found, sum(placed.values()), wrong


def score_folder(folder: Path) -> Score:
    score = Score()
    for path in sorted(folder.iterdir()):
        if path.suffix in REPORT_SUFFIXES and not path.with_suffix(".json").exists():
            print(f"{path.stem}: problem, no answer key beside this report")
            score.problems += 1
    for key_path in sorted(folder.glob("*.json")):
        pdf_path, text_path = key_path.with_suffix(".pdf"), key_path.with_suffix(".txt")
        if not pdf_path.exists() and not text_path.exists():
            print(f"{key_path.stem}: problem, no report beside this key")
            score.problems += 1
            continue
        try:
            key = load_key(key_path)
        except KeyProblem as problem:
            print(f"{key_path.stem}: problem with the answer key, {problem}")
            score.problems += 1
            continue
        score.reports += 1
        started = time.perf_counter()
        try:
            if pdf_path.exists():
                response = read_pdf(pdf_path.read_bytes())
            else:
                response = read_pasted(text_path.read_text())
        except ReportRefused as refusal:
            score.refused += 1
            score.stated += len(key["fractures"])
            print(f"{key_path.stem}: refused, {refusal.code}")
            continue
        except Exception as crash:  # noqa: BLE001
            # Only its type. Error messages can quote their input, which here is a
            # real report, and a traceback would print that message.
            score.problems += 1
            score.stated += len(key["fractures"])
            print(f"{key_path.stem}: problem, the reader failed ({type(crash).__name__})")
            continue
        seconds = time.perf_counter() - started
        score.slowest = max(score.slowest, seconds)
        stated, found, findings, wrong = compare(response, key)
        score.stated += stated
        score.found += found
        score.findings += findings
        score.wrong += wrong
        print(
            f"{key_path.stem}: {found}/{stated} found, {wrong} wrong, {seconds:.2f}s"
        )
    return score


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("folder", type=Path, help="Folder of reports and answer keys")
    folder = parser.parse_args().folder
    if not folder.is_dir():
        print("That folder doesn't exist.", file=sys.stderr)
        return 1
    score = score_folder(folder)
    print()
    if score.reports == 0:
        print(f"No reports could be scored. Problems to fix: {score.problems}")
        print("NOT YET")
        return 1
    print(f"Reports: {score.reports} ({score.refused} refused)")
    print(
        f"Found with the right bone and side: {score.found}/{score.stated} "
        f"= {score.found_share:.1%} (target at least {FOUND_TARGET:.0%})"
    )
    print(
        f"Findings naming a bone or side the report doesn't: {score.wrong}/"
        f"{score.findings} = {score.wrong_share:.1%} (target at most {WRONG_TARGET:.0%})"
    )
    print(f"Slowest report: {score.slowest:.2f}s (target under {SECONDS_TARGET:.0f}s)")
    if score.problems:
        print(f"Problems to fix before this score counts: {score.problems}")
    print("PASS" if score.passes else "NOT YET")
    return 0 if score.passes else 1


if __name__ == "__main__":
    sys.exit(main())
