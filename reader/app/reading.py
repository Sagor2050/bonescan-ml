"""Pick out each fracture a report describes, using rules (Requirements S2.1-S2.4).

The reader never uses AI. The same report always gives the same findings. medspaCy
finds sections, sentences, and "no fracture" or "possible fracture" wording. The
rest matches the report against bones.json and the lists in wordlists.py.
"""

import json
import os
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path
from typing import Callable, Sequence

from app import logging_setup  # noqa: F401
from app import wordlists as words
from app.contract import Finding, PdfWording, TextWording

import medspacy  # noqa: E402
from medspacy.context import ConTextRule  # noqa: E402
from medspacy.ner import TargetRule  # noqa: E402
from medspacy.section_detection import SectionRule  # noqa: E402

CATALOG_PATH = Path(
    os.environ.get(
        "BONES_JSON",
        Path(__file__).resolve().parents[2] / "web/public/shared/bones.json",
    )
)

_LEFT = re.compile(r"\bleft\b", re.IGNORECASE)
_RIGHT = re.compile(r"\bright\b", re.IGNORECASE)
_BILATERAL = re.compile(r"\b(bilateral|bilaterally)\b", re.IGNORECASE)
_UNTITLED_EXAM_LINE = re.compile(
    r"\b(xr|x-?rays?|ct|mri?|radiographs?|radiography|views?)\b", re.IGNORECASE
)
MAX_UNTITLED_EXAM_LINE = 80
_EXAM_LEFT = re.compile(r"\b(left|lt)\b", re.IGNORECASE)
_EXAM_RIGHT = re.compile(r"\b(right|rt)\b", re.IGNORECASE)
_CLAUSE_BREAK = re.compile(
    r";|,?\s+but\s+|,?\s+however\s*,?\s+|,?\s+although\s+"
    r"|,?\s+and\s+(?=no\b)|,\s*(?=no\b)|,?\s+with\s+no\s+",
    re.IGNORECASE,
)
_LIST_NUMBER = re.compile(r"^\s*(?:\d+[.)]|[-*•])\s+")
_LINE_END_STOP = re.compile(r"[.:;?!]\s*$")
_HEADING_LINE = re.compile(r"^\s*(?:[A-Za-z][A-Za-z /]{1,30}:|[A-Z][A-Z /]{2,30}\s*$)")
_LONE_HEADING_LINE = re.compile(r"^\s*[A-Z][A-Z /]{2,30}\s*$")
_NEW_ITEM_LINE = re.compile(r"^\s*(?:\d+[.)]|[-*•])\s")
_DATE_PATTERNS = [
    (re.compile(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b"), "mdy"),
    (re.compile(r"\b(\d{1,2})/(\d{1,2})/(\d{2})\b"), "mdy2"),
    (re.compile(r"\b(\d{1,2})-(\d{1,2})-(\d{4})\b"), "mdy"),
    (re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b"), "ymd"),
    (re.compile(r"\b([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})\b"), "name_first"),
    (re.compile(r"\b(\d{1,2}) ([A-Za-z]{3,9})\.?,? (\d{4})\b"), "day_first"),
]


@dataclass(frozen=True)
class Bone:
    bone: str
    parts: frozenset[str]


@dataclass
class Location:
    """A place a fracture sentence names, before it becomes a finding."""

    kind: str  # bone, outside, or region
    key: str
    start: int
    end: int
    part: list[str] = field(default_factory=list)
    named_type: str | None = None


@dataclass
class Draft:
    """A finding being built, with what's needed to merge duplicates."""

    kind: str
    key: str
    side: str
    section: str
    part: list[str] = field(default_factory=list)
    type_words: list[str] = field(default_factory=list)
    type_kinds: set[str] = field(default_factory=set)
    healing_words: list[str] = field(default_factory=list)
    certain: bool = False
    ranges: list[tuple[int, int]] = field(default_factory=list)


@lru_cache(maxsize=1)
def _catalog() -> dict[str, Bone]:
    entries = json.loads(CATALOG_PATH.read_text())
    bones: dict[str, set[str]] = {}
    for entry in entries:
        bones.setdefault(entry["bone"], set()).update(entry["parts"])
    return {name: Bone(name, frozenset(parts)) for name, parts in bones.items()}


@lru_cache(maxsize=1)
def _bone_patterns() -> list[tuple[re.Pattern[str], str]]:
    """Build one pattern per catalog word, longest words first."""
    entries = json.loads(CATALOG_PATH.read_text())
    seen: dict[str, str] = {}
    for entry in entries:
        for word in entry["words"]:
            seen.setdefault(word.lower(), entry["bone"])
    patterns = []
    for word in sorted(seen, key=len, reverse=True):
        body = r"\s+".join(re.escape(piece) for piece in word.split())
        body = body.replace(r"of\s+", r"of\s+(?:the\s+)?(?:(?:left|right)\s+)?")
        patterns.append((re.compile(rf"\b{body}\b", re.IGNORECASE), seen[word]))
    return patterns


@lru_cache(maxsize=1)
def _nlp():
    nlp = medspacy.load(medspacy_enable=["medspacy_pyrush", "medspacy_target_matcher"])
    nlp.get_pipe("medspacy_target_matcher").add(
        [TargetRule(word, "FRACTURE") for word in words.FRACTURE_WORDS]
    )
    context = nlp.add_pipe("medspacy_context", config={"rules": None})
    rules = []
    rules += [ConTextRule(w, "PSEUDO", direction="PSEUDO") for w in words.NOT_ABSENT]
    rules += [
        ConTextRule(w, "NEGATED_EXISTENCE", direction="FORWARD")
        for w in words.ABSENT_BEFORE
    ]
    rules += [
        ConTextRule(w, "NEGATED_EXISTENCE", direction="BACKWARD")
        for w in words.ABSENT_AFTER
    ]
    rules += [
        ConTextRule(w, "POSSIBLE_EXISTENCE", direction="FORWARD")
        for w in words.UNCERTAIN_BEFORE
    ]
    rules += [
        ConTextRule(w, "POSSIBLE_EXISTENCE", direction="BACKWARD")
        for w in words.UNCERTAIN_AFTER
    ]
    rules += [
        ConTextRule(w, "HYPOTHETICAL", direction="FORWARD")
        for w in words.ASKING_BEFORE
    ]
    rules += [ConTextRule(w, "TERMINATE", direction="TERMINATE") for w in words.ENDS_SCOPE]
    context.add(rules)
    sectionizer = nlp.add_pipe(
        "medspacy_sectionizer",
        config={"rules": None, "require_start_line": True},
    )
    section_rules = []
    for category, headings in words.SECTION_HEADINGS.items():
        for heading in headings:
            section_rules.append(SectionRule(f"{heading}:", category))
    sectionizer.add(section_rules)
    return nlp


def _for_nlp(text: str) -> str:
    """Join lines wrapped mid-sentence, keeping every character's position."""
    characters = list(text)
    lines = text.split("\n")
    position = 0
    for index, line in enumerate(lines[:-1]):
        position += len(line)
        following = lines[index + 1]
        if (
            line.strip()
            and following.strip()
            and not _LINE_END_STOP.search(line)
            and not _LONE_HEADING_LINE.match(line)
            and not _HEADING_LINE.match(following)
            and not _NEW_ITEM_LINE.match(following)
        ):
            characters[position] = " "
        position += 1
    return "".join(characters).replace("\r", " ")


def _section_ranges(doc) -> list[tuple[str | None, int, int]]:
    """List each section's category and where its body starts and ends."""
    ranges = []
    for section in doc._.sections:
        start_token, end_token = section.body_start, section.body_end
        if start_token >= len(doc) or start_token >= end_token:
            continue
        ranges.append(
            (
                section.category,
                doc[start_token].idx,
                doc[end_token - 1].idx + len(doc[end_token - 1]),
            )
        )
    return ranges


def _exam_lines(text: str, sections: list[tuple[str | None, int, int]]) -> list[str]:
    """List the Exam lines, including an untitled one like "XR KNEE RIGHT"."""
    lines = []
    for category, start, end in sections:
        if category == "exam":
            lines.append(text[start:end].split("\n")[0])
        elif category is None:
            lines += [line for line in text[start:end].split("\n") if _is_untitled_exam_line(line)]
    return lines


def _is_untitled_exam_line(line: str) -> bool:
    stripped = line.strip()
    return (
        bool(_UNTITLED_EXAM_LINE.search(stripped))
        and len(stripped) <= MAX_UNTITLED_EXAM_LINE
        and not stripped.endswith(".")
    )


def _exam_side(lines: list[str]) -> str:
    """Take the side from the Exam line, if it names exactly one (S2.1)."""
    named: set[str] = set()
    for line in lines:
        if _BILATERAL.search(line):
            return ""
        if _EXAM_LEFT.search(line):
            named.add("left")
        if _EXAM_RIGHT.search(line):
            named.add("right")
    return named.pop() if len(named) == 1 else ""


def _sentence_side(segment: str) -> list[str]:
    if _BILATERAL.search(segment):
        return ["left", "right"]
    left, right = bool(_LEFT.search(segment)), bool(_RIGHT.search(segment))
    if left and right:
        return []
    if left:
        return ["left"]
    if right:
        return ["right"]
    return []


def _digit_bones(clause: str, hand_or_foot: str) -> list[Location]:
    """Find phalanges by finger or toe, whether named or numbered (Req. A.4)."""
    found = []
    ordinal = "|".join(words.ORDINALS)
    names = "|".join(sorted({*words.HAND_NAMES, *words.FOOT_NAMES}))
    digit = (
        rf"(?P<which>{ordinal}|{names})(?:\s+(?P<kind>finger|toe|digit))?"
        r"|(?P<thumb>thumb|hallux)"
    )
    patterns = [
        rf"\b(?P<position>proximal|middle|distal)\s+(?:phalanx|phalangeal)\s+of\s+"
        rf"(?:the\s+)?(?:(?:left|right)\s+)?(?:{digit})\b",
        rf"\b(?:{digit})\s+(?P<position>proximal|middle|distal)\s+(?:phalanx|phalangeal)\b",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, clause, re.IGNORECASE):
            groups = match.groupdict()
            which = (groups.get("thumb") or groups.get("which") or "").lower()
            kind = (groups.get("kind") or "").lower()
            place = None
            if which == "thumb" or kind == "finger":
                place = "hand"
            elif which == "hallux" or kind == "toe" or which in ("great", "big"):
                place = "foot"
            elif which in ("index", "ring", "long", "pinky", "middle"):
                place = "hand"
            else:
                place = hand_or_foot or None
            if place is None:
                continue
            table = words.HAND_NAMES if place == "hand" else words.FOOT_NAMES
            number = words.ORDINALS.get(which) or table.get(which)
            position = groups["position"].lower()
            if not number or (number == 1 and position == "middle"):
                continue
            bone = f"{position}_phalanx_{place}_{number}"
            if bone in _catalog():
                found.append(Location("bone", bone, match.start(), match.end()))
    return found


def _outside_area(word: str) -> str:
    """Group words for one uncovered area, as in "L2 vertebra" or "rib, ribs"."""
    word = word.lower()
    if re.fullmatch(
        r"vertebrae?|vertebral|spine|spinal|lumbar|thoracic|cervical|odontoid|[ctl]\d{1,2}",
        word,
    ):
        return "spine"
    if word in ("rib", "ribs", "costal"):
        return "rib"
    if word in ("sacrum", "sacral", "coccyx", "coccygeal", "tailbone"):
        return "sacrum"
    if word in ("sternum", "sternal", "breastbone"):
        return "sternum"
    return word


def _region_key(word: str) -> str:
    """Group words for one region, so "pelvis" and "pelvic" are one finding."""
    word = word.lower()
    return words.PELVIS_KEY if word in words.PELVIS_WORDS else word


def _summed_up_bones(locations: list[Location], bones: list[Draft]) -> list[Draft]:
    """The Findings bones that an Impression naming only regions is summing up.

    "Both-bone forearm fracture" sums up whatever Findings listed. A pelvic fracture
    can only sum up the hip bones, so it can't be lost into a radius fracture.
    """
    if not locations or any(location.kind != "region" for location in locations):
        return []
    if any(location.key == words.PELVIS_KEY for location in locations):
        return [bone for bone in bones if bone.key == words.PELVIS_COVERED_BONE]
    return bones


def _locations(clause: str, hand_or_foot: str) -> list[Location]:
    """List every bone, uncovered bone, or region a clause names, in order."""
    candidates: list[Location] = []
    for pattern, bone, part, label in words.NAMED_FRACTURES:
        for match in re.finditer(pattern, clause, re.IGNORECASE):
            candidates.append(
                Location("bone", bone, match.start(), match.end(), [part], label)
            )
    candidates += _digit_bones(clause, hand_or_foot)
    for pattern, bone in _bone_patterns():
        for match in pattern.finditer(clause):
            candidates.append(Location("bone", bone, match.start(), match.end()))
    for match in words.OUTSIDE_COVERAGE.finditer(clause):
        candidates.append(
            Location("outside", _outside_area(match.group(1)), match.start(), match.end())
        )

    chosen: list[Location] = []
    # Named fractures first, then longest matches, so "fifth metacarpal" wins.
    candidates.sort(
        key=lambda c: (c.named_type is None, c.start - c.end, c.start)
    )
    for candidate in candidates:
        overlaps = any(
            candidate.start < other.end and candidate.end > other.start
            for other in chosen
        )
        if overlaps:
            continue
        if candidate.kind == "bone" and candidate.named_type is None:
            after = clause[candidate.end :]
            if words.NOT_THE_BONE_AFTER.match(after) or words.BONE_INTACT_AFTER.match(
                after
            ):
                continue
        chosen.append(candidate)
    chosen.sort(key=lambda c: c.start)

    # One fracture named twice, as in "Colles fracture of the distal radius".
    unique: list[Location] = []
    for location in chosen:
        if location.kind == "outside" and any(
            u.kind == "outside" and u.key == location.key for u in unique
        ):
            continue
        match = next(
            (u for u in unique if u.kind == "bone" and u.key == location.key
             and location.kind == "bone"
             and (u.named_type or location.named_type)),
            None,
        )
        if match:
            match.named_type = match.named_type or location.named_type
            match.part = match.part or location.part
            match.end = max(match.end, location.end)
        else:
            unique.append(location)

    if unique:
        return unique
    regions = [
        Location("region", _region_key(m.group(1)), m.start(), m.end())
        for m in words.REGIONS.finditer(clause)
    ]
    return regions[:1]


def _parts_for(location: Location, clause: str, previous_end: int, next_start: int) -> list[str]:
    bone = _catalog()[location.key]
    is_digit_word = "phalanx" in location.key
    before = clause[previous_end : location.start]
    own = "" if is_digit_word else clause[location.start : location.end]
    after = re.split(r"\band\b|,", clause[location.end : next_start], maxsplit=1)[0]
    window = f"{before} {own} {after}"
    found: list[tuple[int, str]] = []
    for part, pattern in words.PART_WORDS.items():
        if part not in bone.parts:
            continue
        match = re.search(rf"\b(?:{pattern})\b", window, re.IGNORECASE)
        if match:
            found.append((match.start(), part))
    return [part for _, part in sorted(found)]


def _add_unique(target: list[str], items: Sequence[str]) -> None:
    for item in items:
        if item not in target:
            target.append(item)


def _collect_type_words(segment: str, draft: Draft) -> None:
    found: list[tuple[int, str, str]] = []
    claimed: list[tuple[int, int]] = []
    for kind, pattern in words.TYPE_WORDS:
        for match in re.finditer(rf"\b(?:{pattern})\b", segment, re.IGNORECASE):
            if any(match.start() < e and match.end() > s for s, e in claimed):
                continue
            prefix = segment[: match.start()].rstrip().lower()
            if prefix.endswith(("no", "without", "not")):
                continue
            claimed.append((match.start(), match.end()))
            found.append((match.start(), kind, match.group(0).lower()))
    for _, kind, wording in sorted(found):
        if kind not in draft.type_kinds:
            draft.type_kinds.add(kind)
            draft.type_words.append(wording)


def _collect_alignment(segment: str, draft: Draft) -> None:
    for pattern, recorded in words.ALIGNMENT_WORDS:
        if re.search(pattern, segment, re.IGNORECASE) and recorded not in draft.type_kinds:
            draft.type_kinds.add(recorded)
            draft.type_words.append(recorded)


def _healing_words(segment: str) -> list[str]:
    found = []
    for match in words.HEALING_PATTERN.finditer(segment):
        before = segment[: match.start()]
        if words.HEALING_ABSENT.search(before):
            continue
        denied = words.HEALING_DENIED.search(before)
        start = denied.start() if denied else match.start()
        found.append(" ".join(segment[start : match.end()].lower().split()))
    return found


def _collect_healing(segment: str, draft: Draft) -> None:
    _add_unique(draft.healing_words, _healing_words(segment))


def _clauses(start: int, end: int, text: str) -> list[tuple[int, int]]:
    pieces = []
    cursor = start
    for match in _CLAUSE_BREAK.finditer(text, start, end):
        pieces.append((cursor, match.start()))
        cursor = match.end()
    pieces.append((cursor, end))
    return [piece for piece in pieces if text[piece[0] : piece[1]].strip()]


def _can_merge(a: Draft, b: Draft) -> bool:
    if a.kind != b.kind or a.key != b.key:
        return False
    if a.side and b.side and a.side != b.side:
        return False
    if a.section != b.section:
        return True
    if a.kind != "bone":
        return False
    if not a.part or not b.part:
        return True
    return bool(set(a.part) & set(b.part))


def _merge(into: Draft, other: Draft) -> None:
    into.side = into.side or other.side
    _add_unique(into.part, other.part)
    for wording in other.type_words:
        kind = _kind_of(wording)
        if kind not in into.type_kinds:
            into.type_kinds.add(kind)
            into.type_words.append(wording)
    _add_unique(into.healing_words, other.healing_words)
    into.certain = into.certain or other.certain
    for piece in other.ranges:
        if piece not in into.ranges:
            into.ranges.append(piece)


def _kind_of(wording: str) -> str:
    for kind, pattern in words.TYPE_WORDS:
        if re.fullmatch(pattern, wording, re.IGNORECASE):
            return kind
    return wording


def _hand_or_foot(exam_lines: str) -> str:
    hand = re.search(r"\b(hand|finger|thumb|digit)s?\b", exam_lines, re.IGNORECASE)
    foot = re.search(r"\b(foot|feet|toe)s?\b", exam_lines, re.IGNORECASE)
    if bool(hand) == bool(foot):
        return ""
    return "hand" if hand else "foot"


def _sentence_range(sentence, section_start: int, section_end: int, text: str):
    start = max(sentence.start_char, section_start)
    end = min(sentence.end_char, section_end)
    while start < end and text[start].isspace():
        start += 1
    number = _LIST_NUMBER.match(text[start:end])
    if number:
        start += number.end()
    while end > start and text[end - 1].isspace():
        end -= 1
    return start, end


def _read_sentences(text: str, doc, sections, exam_side: str) -> list[Draft]:
    categories = {category for category, _, _ in sections}
    has_read_section = bool(categories & words.READ_SECTIONS)
    hand_or_foot = _hand_or_foot(" ".join(_exam_lines(text, sections)))
    drafts: list[Draft] = []

    for category, section_start, section_end in sections:
        if has_read_section:
            if category not in words.READ_SECTIONS:
                continue
        elif category in words.NOT_READ_SECTIONS and category != "exam":
            continue
        scan_start = section_start
        if category == "exam":
            # Only the Exam line belongs to the Exam section.
            line_end = text.find("\n", section_start, section_end)
            if line_end == -1:
                continue
            scan_start = line_end + 1

        last_in_section: Draft | None = None
        for sentence in doc.sents:
            if sentence.end_char <= scan_start or sentence.start_char >= section_end:
                continue
            start, end = _sentence_range(sentence, scan_start, section_end, text)
            if start >= end:
                continue
            fracture_ents = [
                e for e in sentence.ents if start <= e.start_char < end
            ]
            if not fracture_ents:
                # Healing and alignment words can follow in their own sentence.
                if last_in_section is not None:
                    segment = text[start:end]
                    mentioned = {
                        l.key
                        for l in _locations(segment, hand_or_foot)
                        if l.kind == "bone"
                    }
                    if not mentioned or mentioned == {last_in_section.key}:
                        _collect_alignment(segment, last_in_section)
                        _collect_healing(segment, last_in_section)
                continue

            for clause_start, clause_end in _clauses(start, end, text):
                ents = [
                    e for e in fracture_ents if clause_start <= e.start_char < clause_end
                ]
                live = [
                    e for e in ents if not e._.is_negated and not e._.is_hypothetical
                ]
                if not live:
                    continue
                certain = any(not e._.is_uncertain for e in live)
                clause = text[clause_start:clause_end]
                locations = _locations(clause, hand_or_foot)

                if not locations and drafts:
                    # "The fracture line is well aligned" refers back.
                    target = last_in_section or drafts[-1]
                    target.ranges.append((start, end))
                    _collect_type_words(clause, target)
                    _collect_alignment(clause, target)
                    _collect_healing(clause, target)
                    target.certain = target.certain or certain
                    continue

                bones_so_far = [d for d in drafts if d.kind == "bone"]
                summed_up = _summed_up_bones(locations, bones_so_far)
                if category == "impression" and summed_up:
                    for target in summed_up:
                        if (start, end) not in target.ranges:
                            target.ranges.append((start, end))
                    continue

                previous_parts: list[str] = []
                previous_end = 0
                if not locations:
                    locations = [Location("region", "", 0, 0)]
                for index, location in enumerate(locations):
                    next_start = (
                        locations[index + 1].start
                        if index + 1 < len(locations)
                        else len(clause)
                    )
                    part = list(location.part)
                    if location.kind == "bone":
                        _add_unique(
                            part,
                            _parts_for(location, clause, previous_end, next_start),
                        )
                        joined = clause[previous_end : location.start].strip().lower()
                        if not part and index > 0 and joined in ("and", "or", "&", ","):
                            bone = _catalog()[location.key]
                            part = [p for p in previous_parts if p in bone.parts]
                    window = clause[previous_end : next_start]
                    if index + 1 < len(locations):
                        window = re.split(r"\band\b", window, maxsplit=1)[0]
                    sides = _sentence_side(window) or _sentence_side(clause)
                    if not sides:
                        sides = _sentence_side(text[start:end])
                    if not sides and exam_side and location.key != words.PELVIS_KEY:
                        sides = [exam_side]
                    for side in sides or [""]:
                        draft = Draft(
                            kind=location.kind,
                            key=location.key,
                            side=side,
                            section=category or "",
                            part=list(part),
                            certain=certain,
                            ranges=[(start, end)],
                        )
                        if location.named_type:
                            draft.type_kinds.add(location.named_type)
                            draft.type_words.append(location.named_type)
                        _collect_type_words(clause, draft)
                        _collect_alignment(clause, draft)
                        _collect_healing(clause, draft)
                        existing = next((d for d in drafts if _can_merge(d, draft)), None)
                        if existing:
                            _merge(existing, draft)
                            last_in_section = existing
                        else:
                            drafts.append(draft)
                            last_in_section = draft
                    previous_parts = part
                    previous_end = location.end
    return drafts


def _status(draft: Draft) -> str:
    if draft.kind == "outside":
        return "outside_coverage"
    if draft.kind == "region":
        return "bone_not_stated"
    return "placed" if draft.side else "side_not_stated"


def _parse_date(found: tuple[str, str, str], kind: str) -> date | None:
    a, b, c = found
    try:
        if kind == "mdy":
            return date(int(c), int(a), int(b))
        if kind == "mdy2":
            return date(2000 + int(c), int(a), int(b))
        if kind == "ymd":
            return date(int(a), int(b), int(c))
        month, day, year = (a, b, c) if kind == "name_first" else (b, a, c)
        for layout in ("%B", "%b"):
            try:
                number = datetime.strptime(month, layout).month
                return date(int(year), number, int(day))
            except ValueError:
                continue
    except ValueError:
        return None
    return None


def _dates_in(line: str) -> list[date]:
    found = []
    for pattern, kind in _DATE_PATTERNS:
        for match in pattern.finditer(line):
            parsed = _parse_date(match.groups(), kind)
            if parsed:
                found.append(parsed)
    return found


def _exam_date(text: str, sections, today: date) -> tuple[str | None, list[str]]:
    """Take the date from the Exam line or header, never Comparison (S1.2)."""
    labeled: set[date] = set()
    header: set[date] = set()
    for category, start, end in sections:
        if category == "exam":
            line = text[start:end].split("\n")[0]
            labeled.update(_dates_in(line))
        elif category is None:
            for line in text[start:end].split("\n"):
                if words.NOT_EXAM_DATE_LINE.search(line):
                    continue
                dates = _dates_in(line)
                if _is_untitled_exam_line(line) or re.search(
                    r"\b(exam|study|service|procedure)\b", line, re.IGNORECASE
                ):
                    labeled.update(dates)
                else:
                    header.update(dates)
    chosen = labeled or header
    ordered = sorted(chosen)
    if len(ordered) == 1 and ordered[0] <= today:
        return ordered[0].isoformat(), []
    return None, [d.isoformat() for d in ordered]


@dataclass
class Reading:
    exam_date: str | None
    candidate_dates: list[str]
    findings: list[Finding]


def read_report(
    text: str,
    wording_for: Callable[[int, int], Sequence[PdfWording | TextWording]] | None = None,
    today: date | None = None,
) -> Reading:
    """Read a report's text into its exam date and proposed findings."""
    wording_for = wording_for or (
        lambda start, end: [
            TextWording(start=start, end=end, text=" ".join(text[start:end].split()))
        ]
    )
    clean = _for_nlp(text)
    doc = _nlp()(clean)
    sections = _section_ranges(doc)
    exam_side = _exam_side(_exam_lines(clean, sections))
    drafts = _read_sentences(clean, doc, sections, exam_side)

    findings = []
    for draft in drafts:
        wording: list[PdfWording | TextWording] = []
        for start, end in draft.ranges:
            wording.extend(wording_for(start, end))
        findings.append(
            Finding(
                bone=draft.key if draft.kind == "bone" else "",
                side=draft.side,  # type: ignore[arg-type]
                part=draft.part,
                type_words=draft.type_words,
                certainty="certain" if draft.certain else "uncertain",
                healing_words=draft.healing_words,
                status=_status(draft),  # type: ignore[arg-type]
                wording=wording,
                entered_by_patient=False,
            )
        )
    exam_date, candidates = _exam_date(text, sections, today or date.today())
    return Reading(exam_date, candidates, findings)
