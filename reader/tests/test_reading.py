"""The reading rules, checked against Requirements Appendix A and S2.1-S2.4.

When a rule misses a case, add the case here. Everything here is fictional.
"""

import json
from datetime import date
from pathlib import Path

import pytest

from app.main import read_pasted, read_pdf
from app.reading import _healing_words, read_report

FIXTURES = Path(__file__).resolve().parents[2] / "tests" / "fixtures"


def findings(body: str, exam: str = "XR LEFT WRIST"):
    return read_report(f"EXAM: {exam}\nFINDINGS: {body}").findings


def only(body: str, exam: str = "XR LEFT WRIST"):
    found = findings(body, exam)
    assert len(found) == 1, [f.model_dump() for f in found]
    return found[0]


# Requirements Appendix B: the first acceptance tests.


@pytest.mark.parametrize("report", ["b1", "b2"])
def test_appendix_b_pasted_gives_exactly_the_expected_response(report):
    text = (FIXTURES / f"report-{report}.txt").read_text().rstrip("\n")
    expected = json.loads((FIXTURES / f"read-{report}-pasted.json").read_text())
    assert read_pasted(text).model_dump() == expected


@pytest.mark.parametrize("report", ["b1", "b2"])
def test_appendix_b_pdf_gives_exactly_the_expected_response(report):
    data = (FIXTURES / f"report-{report}.pdf").read_bytes()
    expected = json.loads((FIXTURES / f"read-{report}-pdf.json").read_text())
    assert read_pdf(data).model_dump() == expected


# A.1: only Findings and Impression produce findings.


@pytest.mark.parametrize("heading", ["HISTORY", "INDICATION", "COMPARISON", "TECHNIQUE"])
def test_other_sections_never_produce_findings(heading):
    report = (
        f"EXAM: XR LEFT WRIST\n{heading}: Distal radius fracture.\n"
        "FINDINGS: Normal alignment.\nIMPRESSION: Unremarkable."
    )
    assert read_report(report).findings == []


def test_exam_line_never_produces_a_finding():
    assert read_report("EXAM: LEFT WRIST FRACTURE\nFINDINGS: Normal.").findings == []


def test_report_with_no_headings_is_read_as_all_findings():
    [finding] = read_report("There is a fracture of the left distal radius.").findings
    assert (finding.bone, finding.side) == ("radius", "left")


def test_lowercase_headings_are_found():
    report = "History: Radius fracture.\nFindings: Normal.\nImpression: Unremarkable."
    assert read_report(report).findings == []


def test_same_fracture_in_findings_and_impression_is_one_finding():
    report = (
        "EXAM: XR LEFT FOREARM\nFINDINGS: Fracture of the ulnar shaft.\n"
        "IMPRESSION: Left ulna shaft fracture."
    )
    [finding] = read_report(report).findings
    assert finding.bone == "ulna"
    assert len(finding.wording) == 2


def test_impression_can_supply_the_side_the_findings_lacks():
    report = "FINDINGS: Fracture of the ulnar shaft.\nIMPRESSION: Left ulna shaft fracture."
    [finding] = read_report(report).findings
    assert (finding.side, finding.status) == ("left", "placed")


def test_two_fractures_of_one_bone_stay_two_findings():
    found = findings("Fracture of the distal radius. Fracture of the proximal radius.")
    assert [f.part for f in found] == [["distal"], ["proximal"]]


def test_two_bones_in_one_sentence_are_two_findings():
    found = findings("Fractures of the distal radius and ulna.")
    assert [f.bone for f in found] == ["radius", "ulna"]
    assert [f.part for f in found] == [["distal"], ["distal"]]


def test_each_bone_keeps_its_own_part():
    found = findings("Fractures of the distal radius and proximal ulna.")
    assert [f.part for f in found] == [["distal"], ["proximal"]]


def test_a_fracture_sentence_with_no_bone_refers_back():
    report = (
        "EXAM: XR LEFT WRIST\nFINDINGS: Distal radius fracture. "
        "The fracture line is transverse."
    )
    [finding] = read_report(report).findings
    assert finding.type_words == ["transverse"]


# A.6: Absent.


@pytest.mark.parametrize(
    "sentence",
    [
        "No fracture.",
        "No fracture of the ulna.",
        "Negative for fracture.",
        "No acute fracture.",
        "No new fracture.",
        "There is no new fracture.",
        "No evidence of fracture of the tibia.",
        "No fracture or dislocation.",
        "No fractures.",
        "Without evidence of fracture.",
        "Fracture is not seen.",
        "A fracture is not identified.",
    ],
)
def test_absent_fractures_create_no_finding(sentence):
    assert findings(sentence) == []


def test_negation_covers_only_its_own_sentence():
    found = findings("Fracture of the radius. No fracture of the ulna.")
    assert [f.bone for f in found] == ["radius"]


def test_negation_stops_at_but():
    found = findings("No fracture of the ulna, but there is a radius fracture.")
    assert [f.bone for f in found] == ["radius"]


@pytest.mark.parametrize(
    "sentence",
    [
        "No displacement of the radius fracture.",
        "No angulation of the radius fracture.",
        "No significant displacement of the radius fracture.",
        "No change in the radius fracture.",
        "No interval change in the radius fracture.",
        "No callus around the radius fracture.",
    ],
)
def test_no_in_front_of_something_else_keeps_the_fracture(sentence):
    assert only(sentence).bone == "radius"


def test_radius_fracture_without_displacement_is_kept():
    assert only("Radius fracture without displacement.").bone == "radius"


@pytest.mark.parametrize(
    "sentence",
    ["Rule out fracture of the radius.", "Evaluate for fracture of the radius."],
)
def test_asking_about_a_fracture_creates_no_finding(sentence):
    assert findings(sentence) == []


# A.6: Uncertain.


@pytest.mark.parametrize(
    "sentence",
    [
        "Possible fracture of the scaphoid.",
        "Probable fracture of the scaphoid.",
        "Suspected fracture of the scaphoid.",
        "Questionable fracture of the scaphoid.",
        "A fracture of the scaphoid cannot be excluded.",
        "Scaphoid fracture cannot be ruled out.",
        "Cannot exclude a scaphoid fracture.",
        "Findings suspicious for a scaphoid fracture.",
        "Lucency through the bone, concerning for a scaphoid fracture.",
    ],
)
def test_uncertain_words_mark_the_finding_uncertain(sentence):
    finding = only(sentence)
    assert (finding.bone, finding.certainty) == ("scaphoid", "uncertain")


def test_plain_fracture_is_certain():
    assert only("Fracture of the scaphoid.").certainty == "certain"


def test_certain_in_impression_wins_over_possible_in_findings():
    report = (
        "EXAM: XR LEFT WRIST\nFINDINGS: Possible scaphoid fracture.\n"
        "IMPRESSION: Scaphoid fracture."
    )
    [finding] = read_report(report).findings
    assert finding.certainty == "certain"


# A.6: healing words, recorded as written, and never worked out (S5.3).


@pytest.mark.parametrize(
    "sentence, expected",
    [
        ("Acute radius fracture.", ["acute"]),
        ("Healing radius fracture.", ["healing"]),
        ("Radius fracture with callus formation.", ["callus formation"]),
        ("Radius fracture with interval healing.", ["interval healing"]),
        ("Radius fracture with interval callus formation.", ["interval callus formation"]),
        ("Healed radius fracture.", ["healed"]),
        ("United radius fracture.", ["united"]),
        ("Remodeled radius fracture.", ["remodeled"]),
        ("Old radius fracture.", ["old"]),
        ("Radius fracture with nonunion.", ["nonunion"]),
        ("Radius fracture with delayed union.", ["delayed union"]),
        ("Radius fracture with malunion.", ["malunion"]),
        ("Radius fracture.", []),
    ],
)
def test_healing_words(sentence, expected):
    assert only(sentence).healing_words == expected


def test_healing_words_can_follow_in_their_own_sentence():
    assert only("Radius fracture. Callus formation is noted.").healing_words == [
        "callus formation"
    ]


def test_no_callus_is_not_a_healing_word():
    assert only("Radius fracture with no callus.").healing_words == []


@pytest.mark.parametrize(
    "sentence, expected",
    [
        ("Radius fracture has not healed.", ["not healed"]),
        ("Radius fracture is not united.", ["not united"]),
        ("Radius fracture, not healing.", ["not healing"]),
        ("Radius fracture has not yet healed.", ["not yet healed"]),
        ("Radius fracture is not fully united.", ["not fully united"]),
        ("Radius fracture has not yet fully healed.", ["not yet fully healed"]),
        ("Radius fracture hasn't healed.", ["hasn't healed"]),
        ("Radius fracture has NOT healed.", ["not healed"]),
    ],
)
def test_a_denied_status_keeps_the_reports_whole_phrase(sentence, expected):
    assert only(sentence).healing_words == expected


def test_a_denied_status_can_follow_in_its_own_sentence():
    assert only("Radius fracture. It has not healed.").healing_words == ["not healed"]


def test_a_denied_status_can_run_over_a_line_break():
    assert only("Radius fracture has not\nhealed.").healing_words == ["not healed"]


@pytest.mark.parametrize(
    "sentence",
    [
        "Radius fracture. No evidence of healing.",
        "Radius fracture without healing.",
        "Radius fracture without evidence of healing.",
        "Radius fracture with no visible callus.",
        "Radius fracture with no significant callus formation.",
        "Radius fracture. Absence of callus.",
        "Radius fracture. No acute displacement.",
    ],
)
def test_an_absent_sign_of_healing_is_no_healing_word(sentence):
    assert only(sentence).healing_words == []


def test_a_negation_in_another_clause_leaves_the_healing_word_alone():
    assert only("Radius fracture, not displaced, healing.").healing_words == ["healing"]


@pytest.mark.parametrize(
    "clause, expected",
    [
        ("no displacement and interval healing", ["interval healing"]),
        ("no displacement with callus", ["callus"]),
        ("not displaced but healing", ["healing"]),
        ("not displaced or healing", ["healing"]),
    ],
)
def test_a_joining_word_ends_a_negation(clause, expected):
    assert _healing_words(clause) == expected


@pytest.mark.parametrize(
    "sentence",
    ["Radius fracture in a 5 year old.", "Radius fracture in a patient 40 years old."],
)
def test_a_patients_age_is_no_healing_word(sentence):
    assert only(sentence).healing_words == []


@pytest.mark.parametrize(
    "sentence, expected",
    [
        ("Radius fracture. Alignment is unchanged.", "alignment unchanged"),
        ("Radius fracture. Alignment unchanged.", "alignment unchanged"),
        ("Radius fracture with increased displacement.", "increased displacement"),
    ],
)
def test_alignment_words(sentence, expected):
    assert expected in only(sentence).type_words


# A.5: fracture words and named fractures.


@pytest.mark.parametrize(
    "word",
    [
        "nondisplaced",
        "non-displaced",
        "displaced",
        "angulated",
        "comminuted",
        "transverse",
        "oblique",
        "spiral",
        "impacted",
        "avulsion",
        "intra-articular",
        "stress",
        "hairline",
        "occult",
    ],
)
def test_fracture_words_are_recorded(word):
    assert only(f"There is a {word} fracture of the radius.").type_words == [word]


def test_type_words_keep_their_degree_and_direction():
    assert only("Radius fracture with mild dorsal angulation.").type_words == [
        "mild dorsal angulation"
    ]


def test_no_displacement_is_not_recorded_as_displaced():
    assert only("Nondisplaced radius fracture.").type_words == ["nondisplaced"]


@pytest.mark.parametrize(
    "name, bone, part",
    [
        ("Colles fracture", "radius", ["distal"]),
        ("Colles' fracture", "radius", ["distal"]),
        ("Smith fracture", "radius", ["distal"]),
        ("Smith's fracture", "radius", ["distal"]),
        ("Boxer's fracture", "metacarpal_5", ["neck"]),
        ("Boxer fracture", "metacarpal_5", ["neck"]),
        ("Jones fracture", "metatarsal_5", ["base"]),
        ("Hip fracture", "femur", ["proximal"]),
        ("Scaphoid fracture", "scaphoid", []),
    ],
)
def test_named_fractures_land_on_their_bone_and_part(name, bone, part):
    finding = only(f"{name}.")
    assert (finding.bone, finding.part) == (bone, part)


def test_a_named_fracture_and_its_bone_are_one_finding():
    finding = only("Colles fracture of the left distal radius.")
    assert (finding.bone, finding.side, finding.part) == ("radius", "left", ["distal"])


def test_negated_named_fracture_creates_no_finding():
    assert findings("No Colles fracture.") == []


# bones.json: bones, adjectives, and parts.


@pytest.mark.parametrize(
    "words, bone",
    [
        ("radial", "radius"),
        ("ulnar", "ulna"),
        ("humeral", "humerus"),
        ("femoral", "femur"),
        ("tibial", "tibia"),
        ("fibular", "fibula"),
        ("calcaneal", "calcaneus"),
        ("clavicular", "clavicle"),
        ("scapular", "scapula"),
        ("patellar", "patella"),
        ("talar", "talus"),
        ("fifth metatarsal", "metatarsal_5"),
        ("first metacarpal", "metacarpal_1"),
    ],
)
def test_bone_words(words, bone):
    assert only(f"Left {words} fracture.").bone == bone


@pytest.mark.parametrize(
    "words, bone, part",
    [
        ("femoral neck", "femur", ["neck"]),
        ("humeral head", "humerus", ["head"]),
        ("radial styloid", "radius", ["styloid"]),
        ("ulnar styloid", "ulna", ["styloid"]),
        ("medial malleolus", "tibia", ["medial_malleolus"]),
        ("lateral malleolus", "fibula", ["lateral_malleolus"]),
        ("tibial plateau", "tibia", ["plateau"]),
        ("olecranon", "ulna", ["olecranon"]),
        ("scaphoid waist", "scaphoid", ["waist"]),
        ("hook of hamate", "hamate", ["hook"]),
        ("mid-shaft humerus", "humerus", ["shaft"]),
        ("humeral diaphysis", "humerus", ["shaft"]),
        ("base of the fifth metatarsal", "metatarsal_5", ["base"]),
        ("fifth metacarpal neck", "metacarpal_5", ["neck"]),
        ("acetabular", "hip_bone", ["acetabulum"]),
    ],
)
def test_parts(words, bone, part):
    finding = only(f"Left {words} fracture.")
    assert (finding.bone, finding.part) == (bone, part)


def test_no_part_means_the_whole_bone():
    assert only("Left radius fracture.").part == []


# A.4: fingers and toes, by name or number.


@pytest.mark.parametrize(
    "words, exam, bone",
    [
        ("proximal phalanx of the thumb", "XR HAND", "proximal_phalanx_hand_1"),
        ("distal phalanx of the index finger", "XR HAND", "distal_phalanx_hand_2"),
        ("middle phalanx of the ring finger", "XR HAND", "middle_phalanx_hand_4"),
        ("proximal phalanx of the long finger", "XR HAND", "proximal_phalanx_hand_3"),
        ("proximal phalanx of the small finger", "XR HAND", "proximal_phalanx_hand_5"),
        ("fifth finger proximal phalanx", "XR HAND", "proximal_phalanx_hand_5"),
        ("proximal phalanx of the great toe", "XR FOOT", "proximal_phalanx_foot_1"),
        ("distal phalanx of the big toe", "XR FOOT", "distal_phalanx_foot_1"),
        ("distal phalanx of the second toe", "XR FOOT", "distal_phalanx_foot_2"),
        ("proximal phalanx of the third digit", "XR HAND", "proximal_phalanx_hand_3"),
        ("proximal phalanx of the third digit", "XR FOOT", "proximal_phalanx_foot_3"),
    ],
)
def test_fingers_and_toes(words, exam, bone):
    assert only(f"Left {words} fracture.", exam).bone == bone


def test_position_word_in_a_phalanx_name_is_not_its_part():
    assert only("Left proximal phalanx of the thumb fracture.", "XR HAND").part == []


def test_part_of_a_phalanx_can_still_be_stated():
    finding = only("Left distal phalanx of the great toe, proximal fracture.", "XR FOOT")
    assert finding.bone == "distal_phalanx_foot_1"


@pytest.mark.parametrize("words", ["phalanx", "metacarpal", "metatarsal"])
def test_group_of_bones_without_a_number_is_bone_not_stated(words):
    finding = only(f"Left {words} fracture.")
    assert (finding.bone, finding.status) == ("", "bone_not_stated")


def test_thumb_has_no_middle_phalanx():
    assert only("Left middle phalanx of the thumb fracture.", "XR HAND").bone == ""


# The bone must be the one that broke.


@pytest.mark.parametrize(
    "sentence",
    [
        "Fracture of the scaphoid, radial aspect.",
        "Scaphoid fracture with ulnar deviation.",
        "Scaphoid fracture near the radial artery.",
    ],
)
def test_direction_words_are_not_bones(sentence):
    assert only(sentence).bone == "scaphoid"


def test_bone_described_as_intact_is_not_a_finding():
    assert only("Fracture of the radius with the ulna intact.").bone == "radius"


# S2.1: the side.


def test_side_comes_from_the_sentence_first():
    assert only("Right radius fracture.", "XR LEFT WRIST").side == "right"


def test_side_comes_from_an_exam_line_naming_one_side():
    assert only("Radius fracture.", "XR LEFT WRIST").side == "left"
    assert only("Radius fracture.", "XR WRIST RT").side == "right"


@pytest.mark.parametrize("exam", ["XR WRIST", "XR WRISTS BILATERAL", "XR LEFT AND RIGHT WRIST"])
def test_no_single_side_gives_side_not_stated(exam):
    finding = only("Radius fracture.", exam)
    assert (finding.bone, finding.side, finding.status) == (
        "radius",
        "",
        "side_not_stated",
    )


def test_two_sides_in_one_sentence_stay_with_their_bones():
    found = findings("Left radius fracture and right ulna fracture.", "XR ARMS")
    assert [(f.bone, f.side) for f in found] == [("radius", "left"), ("ulna", "right")]


def test_bilateral_gives_a_finding_on_each_side():
    found = findings("Bilateral distal radius fractures.", "XR WRISTS")
    assert [(f.bone, f.side) for f in found] == [("radius", "left"), ("radius", "right")]


def test_both_bones_does_not_mean_both_sides():
    found = findings("Fractures of both the radius and ulna.", "XR LEFT FOREARM")
    assert [(f.bone, f.side) for f in found] == [("radius", "left"), ("ulna", "left")]


@pytest.mark.parametrize(
    "line, side",
    [("XR KNEE RIGHT", "right"), ("CT LEFT ANKLE 05/05/2026", "left")],
)
def test_untitled_exam_line_gives_the_side(line, side):
    [finding] = read_report(f"{line}\nFINDINGS: Tibia fracture.").findings
    assert finding.side == side


def test_a_finding_sentence_is_not_mistaken_for_an_exam_line():
    [finding] = read_report("Tibia fracture seen on x-ray of the right knee.").findings
    assert finding.side == "right"
    [finding] = read_report(
        "The left leg was on the x-ray.\nThere is a tibia fracture."
    ).findings
    assert finding.status == "side_not_stated"


# S2.4: findings that can't be placed.


@pytest.mark.parametrize(
    "sentence",
    [
        "Fracture of the left 5th rib.",
        "Compression fracture of the L2 vertebra.",
        "Skull fracture.",
        "Sacral fracture.",
        "Fracture of the sternum.",
        "Coccyx fracture.",
        "Hyoid fracture.",
        "Fracture of the mandible.",
        "Thoracic spine fracture.",
    ],
)
def test_uncovered_bones_are_listed_as_outside_coverage(sentence):
    finding = only(sentence)
    assert (finding.bone, finding.status) == ("", "outside_coverage")


def test_region_in_impression_sums_up_the_findings():
    report = (
        "EXAM: XR LEFT FOREARM\nFINDINGS: Fractures of the radius and ulna.\n"
        "IMPRESSION: Both-bone forearm fracture."
    )
    found = read_report(report).findings
    assert [f.bone for f in found] == ["radius", "ulna"]
    assert all(len(f.wording) == 2 for f in found)


def test_rib_in_findings_and_impression_is_one_finding():
    report = "FINDINGS: Fracture of the left 5th rib.\nIMPRESSION: Rib fracture."
    assert len(read_report(report).findings) == 1


def test_covered_and_uncovered_bones_in_one_sentence():
    found = findings("Fractures of the left clavicle and left 5th rib.")
    assert [(f.bone, f.status) for f in found] == [
        ("clavicle", "placed"),
        ("", "outside_coverage"),
    ]


@pytest.mark.parametrize("region", ["wrist", "ankle", "elbow", "knee", "foot", "hand", "thumb"])
def test_region_without_a_bone_is_bone_not_stated(region):
    finding = only(f"Left {region} fracture.")
    assert (finding.bone, finding.status) == ("", "bone_not_stated")


def test_fracture_with_no_place_at_all_is_bone_not_stated():
    finding = only("There is an acute fracture.")
    assert (finding.bone, finding.status) == ("", "bone_not_stated")


def test_fractures_only():
    assert findings("Dislocation of the left shoulder. Arthritis of the knee.") == []


def test_report_with_no_fractures_has_no_findings():
    assert findings("The bones are normal.") == []


# S1.2: the exam date.


TODAY = date(2026, 11, 5)


def exam_date(report: str):
    reading = read_report(report, today=TODAY)
    return reading.exam_date, reading.candidate_dates


@pytest.mark.parametrize(
    "line",
    [
        "DATE OF EXAM: 09/14/2026",
        "EXAM DATE: 9/14/2026",
        "EXAM: XR LEFT WRIST 09/14/2026",
        "Study Date: 2026-09-14",
        "DATE OF EXAM: September 14, 2026",
        "DATE OF EXAM: Sep 14, 2026",
        "DATE OF EXAM: 14 September 2026",
        "DATE OF EXAM: 09/14/26",
    ],
)
def test_one_exam_date_is_filled_in(line):
    assert exam_date(f"{line}\nFINDINGS: Normal.") == ("2026-09-14", [])


def test_untitled_exam_line_gives_the_date():
    report = "CT PELVIS 05/05/2026\n10/20/2026\nFINDINGS: Normal."
    assert exam_date(report) == ("2026-05-05", [])


def test_header_date_is_used_when_there_is_no_exam_line():
    assert exam_date("09/14/2026\nFINDINGS: Normal.") == ("2026-09-14", [])


def test_comparison_date_is_never_used():
    report = "EXAM: XR WRIST\nCOMPARISON: 09/14/2026.\nFINDINGS: Normal."
    assert exam_date(report) == (None, [])


def test_exam_date_beats_a_comparison_date():
    report = "DATE OF EXAM: 10/12/2026\nCOMPARISON: 09/14/2026.\nFINDINGS: Normal."
    assert exam_date(report) == ("2026-10-12", [])


def test_no_date_asks_the_patient():
    assert exam_date("FINDINGS: Normal.") == (None, [])


def test_several_dates_give_candidates():
    report = "09/14/2026\n10/12/2026\nFINDINGS: Normal."
    assert exam_date(report) == (None, ["2026-09-14", "2026-10-12"])


def test_exam_line_beats_other_header_dates():
    report = "10/20/2026\nDATE OF EXAM: 09/14/2026\nFINDINGS: Normal."
    assert exam_date(report) == ("2026-09-14", [])


def test_birth_date_and_signed_date_are_ignored():
    report = "DOB: 01/02/1960\nSigned: 09/15/2026\n09/14/2026\nFINDINGS: Normal."
    assert exam_date(report) == ("2026-09-14", [])


def test_future_date_is_not_filled_in():
    assert exam_date("DATE OF EXAM: 12/25/2026\nFINDINGS: Normal.") == (
        None,
        ["2026-12-25"],
    )


def test_impossible_date_is_ignored():
    assert exam_date("DATE OF EXAM: 13/45/2026\nFINDINGS: Normal.") == (None, [])


# Wording.


def test_numbered_list_wording_leaves_out_the_number():
    report = "EXAM: XR LEFT WRIST\nIMPRESSION:\n1. Distal radius fracture.\n2. No dislocation."
    [finding] = read_report(report).findings
    assert finding.wording[0].text == "Distal radius fracture."


def test_wording_range_points_at_the_pasted_text():
    report = "EXAM: XR LEFT WRIST\nFINDINGS: Normal alignment. Radius fracture."
    [finding] = read_report(report).findings
    [piece] = finding.wording
    assert report[piece.start : piece.end] == "Radius fracture."


def test_same_report_always_gives_the_same_findings():
    report = (FIXTURES / "report-b1.txt").read_text()
    assert read_report(report).findings == read_report(report).findings


def test_windows_line_endings_are_read_the_same():
    report = "EXAM: XR LEFT WRIST\r\nFINDINGS: Radius\r\nfracture.\r\n"
    [finding] = read_report(report).findings
    assert (finding.bone, finding.side) == ("radius", "left")


# The pelvis is more than one bone, so it can't be placed or given a side (#57).


@pytest.mark.parametrize(
    "body",
    [
        "Fracture of the pelvis.",
        "Pelvic fracture.",
        "Pelvic ring fracture.",
        "Fractured pelvis.",
    ],
)
def test_a_pelvis_wide_fracture_says_the_bone_is_not_stated(body):
    finding = only(body, exam="XR PELVIS")
    assert finding.status == "bone_not_stated"
    assert finding.bone == ""
    assert finding.side == ""


def test_a_pelvis_wide_fracture_never_takes_its_side_from_the_exam_line():
    finding = only("Pelvic ring fracture.", exam="XR LEFT HIP")
    assert finding.status == "bone_not_stated"
    assert finding.side == ""


def test_a_side_the_sentence_states_is_kept_but_still_not_placed():
    finding = only("Left pelvic fracture.", exam="XR PELVIS")
    assert finding.status == "bone_not_stated"
    assert finding.bone == ""
    assert finding.side == "left"


@pytest.mark.parametrize(
    "words, part",
    [
        ("left acetabular", ["acetabulum"]),
        ("left iliac", ["ilium"]),
        ("left ischial", ["ischium"]),
        ("left pubic", ["pubis"]),
    ],
)
def test_naming_a_part_of_the_hip_bone_still_places_it(words, part):
    finding = only(f"Fracture of the {words} bone.", exam="XR PELVIS")
    assert (finding.bone, finding.side, finding.part) == ("hip_bone", "left", part)
    assert finding.status == "placed"


def test_the_pelvis_mentioned_with_a_named_bone_adds_no_finding():
    finding = only("Pelvic fracture involving the left acetabulum.", exam="XR PELVIS")
    assert (finding.bone, finding.side) == ("hip_bone", "left")


def test_a_pelvic_radiograph_is_not_a_second_fracture():
    finding = only("Right femoral neck fracture on the pelvic radiograph.", exam="XR PELVIS")
    assert (finding.bone, finding.side) == ("femur", "right")


@pytest.mark.parametrize(
    "body", ["No pelvic fracture.", "Negative for fracture of the pelvis."]
)
def test_a_ruled_out_pelvic_fracture_creates_no_finding(body):
    assert findings(body, exam="XR PELVIS") == []


def test_pelvis_in_findings_and_pelvic_in_impression_are_one_finding():
    report = (
        "EXAM: XR PELVIS\n"
        "FINDINGS: Fracture of the pelvis.\n"
        "IMPRESSION: Pelvic fracture."
    )
    found = read_report(report).findings
    assert len(found) == 1
    assert found[0].status == "bone_not_stated"
    assert len(found[0].wording) == 2


def test_a_pelvic_impression_sums_up_a_hip_bone_in_findings():
    report = (
        "EXAM: XR PELVIS\n"
        "FINDINGS: Left acetabular fracture.\n"
        "IMPRESSION: Pelvic fracture."
    )
    found = read_report(report).findings
    assert [(f.bone, f.side) for f in found] == [("hip_bone", "left")]
    assert len(found[0].wording) == 2


def test_a_pelvic_impression_is_not_lost_into_another_bone():
    report = (
        "EXAM: XR PELVIS AND LEFT WRIST\n"
        "FINDINGS: Left distal radius fracture.\n"
        "IMPRESSION: Pelvic fracture."
    )
    found = read_report(report).findings
    assert [(f.bone, f.status) for f in found] == [
        ("radius", "placed"),
        ("", "bone_not_stated"),
    ]
    assert len(found[0].wording) == 1


def test_other_regions_in_the_impression_still_sum_up_findings():
    report = (
        "EXAM: XR LEFT FOREARM\n"
        "FINDINGS: Fractures of the left radius and left ulna.\n"
        "IMPRESSION: Both-bone forearm fracture."
    )
    assert [f.bone for f in read_report(report).findings] == ["radius", "ulna"]
