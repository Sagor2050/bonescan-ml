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

FOUND_TARGET = 0.90
WRONG_TARGET = 0.05
SECONDS_TARGET = 10.0


@dataclass
class Score:
    reports: int = 0
    refused: int = 0
    stated: int = 0
    found: int = 0
    findings: int = 0
    wrong: int = 0
    slowest: float = 0.0

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
            and self.found_share >= FOUND_TARGET
            and self.wrong_share <= WRONG_TARGET
            and self.slowest < SECONDS_TARGET
        )


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
    for key_path in sorted(folder.glob("*.json")):
        key = json.loads(key_path.read_text())
        pdf_path, text_path = key_path.with_suffix(".pdf"), key_path.with_suffix(".txt")
        if not pdf_path.exists() and not text_path.exists():
            print(f"{key_path.stem}: no report beside this key", file=sys.stderr)
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
    score = score_folder(folder)
    print()
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
    print("PASS" if score.passes else "NOT YET")
    return 0 if score.passes else 1


if __name__ == "__main__":
    sys.exit(main())
