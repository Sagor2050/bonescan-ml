"""The words the reader looks for, from Requirements Appendix A.

Bone words live in web/public/shared/bones.json, the one bone catalog. These are
the other lists. When a rule misses a case, add the case to tests/test_reading.py.
"""

import re

FRACTURE_WORDS = ["fracture", "fractures", "fractured", "fx", "fxs"]

# Requirements A.1. A heading ends with a colon, or sits alone in capitals.
SECTION_HEADINGS = {
    "exam": [
        "exam",
        "examination",
        "exam type",
        "study",
        "procedure",
        "date of exam",
        "exam date",
        "date of study",
        "study date",
        "date of service",
    ],
    "history": [
        "history",
        "clinical history",
        "indication",
        "indications",
        "reason for exam",
        "clinical information",
    ],
    "comparison": ["comparison", "comparisons", "prior studies", "priors"],
    "technique": ["technique", "views"],
    "findings": ["findings", "finding"],
    "impression": ["impression", "conclusion", "conclusions", "opinion", "assessment"],
}
READ_SECTIONS = {"findings", "impression"}
NOT_READ_SECTIONS = {"exam", "history", "comparison", "technique"}

# Requirements A.6: Absent. These come before the fracture they rule out.
ABSENT_BEFORE = [
    "no",
    "no acute",
    "no new",
    "no evidence of",
    "no evidence for",
    "no radiographic evidence of",
    "no definite",
    "negative for",
    "without",
    "without evidence of",
    "absence of",
    "free of",
]
ABSENT_AFTER = [
    "not seen",
    "not identified",
    "not present",
    "not visualized",
    "is excluded",
    "are excluded",
    "has been excluded",
    "is ruled out",
    "has been ruled out",
    "absent",
]
# These start with "no" but don't rule out the fracture itself.
NOT_ABSENT = [
    "no displacement",
    "no significant displacement",
    "no evidence of displacement",
    "no angulation",
    "no significant angulation",
    "no change",
    "no interval change",
    "no significant change",
    "no healing",
    "no callus",
    "no evidence of healing",
    "no evidence of union",
    "without displacement",
    "without angulation",
    "without healing",
]

# Requirements A.6: Uncertain.
UNCERTAIN_BEFORE = [
    "possible",
    "possibly",
    "probable",
    "probably",
    "suspected",
    "suspicious for",
    "concerning for",
    "concerning",
    "questionable",
    "concern for",
    "may represent",
    "likely",
    "presumed",
    "cannot exclude",
    "can not exclude",
    "cannot rule out",
]
UNCERTAIN_AFTER = [
    "cannot be excluded",
    "can not be excluded",
    "cannot be ruled out",
    "not excluded",
    "not ruled out",
    "is suspected",
    "is possible",
    "is questioned",
    "suspected",
]
# Wording that asks about a fracture rather than describing one.
ASKING_BEFORE = ["rule out", "r/o", "evaluate for", "assess for", "to exclude"]
ENDS_SCOPE = ["but", "however", "although", "except", ";"]

# Requirements A.5. Each is (pattern, bone, part, the words recorded).
NAMED_FRACTURES = [
    (r"colles'?s?(?:'s)? fracture", "radius", "distal", "colles fracture"),
    (r"smith'?s? fracture", "radius", "distal", "smith fracture"),
    (r"boxer'?s?'? fracture", "metacarpal_5", "neck", "boxer's fracture"),
    (r"jones'? fracture", "metatarsal_5", "base", "jones fracture"),
    (r"hip fracture", "femur", "proximal", "hip fracture"),
    (r"fracture of the (?:(?:left|right) )?hip", "femur", "proximal", "hip fracture"),
]

_DEGREE = r"(?:(?:mild|mildly|minimal|minimally|moderate|moderately|marked|markedly|severe|severely|slight|slightly) )"
_DIRECTION = r"(?:(?:dorsal|dorsally|volar|volarly|palmar|medial|medially|lateral|laterally|anterior|anteriorly|posterior|posteriorly|apex \w+) )"

# Requirements A.5, as (kind, pattern). Findings keep the first wording of a kind.
TYPE_WORDS = [
    ("nondisplaced", rf"{_DEGREE}?non-?displaced"),
    ("displaced", rf"{_DEGREE}?{_DIRECTION}?displaced"),
    ("angulation", rf"{_DEGREE}?{_DIRECTION}?angulat(?:ion|ed)"),
    ("comminuted", r"comminuted"),
    ("transverse", r"transverse"),
    ("oblique", r"oblique"),
    ("spiral", r"spiral"),
    ("impacted", r"impacted"),
    ("avulsion", r"avulsion"),
    ("intra-articular", r"intra-?articular"),
    ("stress", r"stress"),
    ("hairline", r"hairline"),
    ("occult", r"occult"),
]

# Requirements A.6: Alignment, as (pattern, the words recorded).
ALIGNMENT_WORDS = [
    (r"alignment (?:is |remains )?unchanged|unchanged alignment", "alignment unchanged"),
    (r"increased displacement", "increased displacement"),
]

# Requirements A.6: New, Healing, Healed, Not healing, Healed out of line.
HEALING_PATTERN = re.compile(
    r"(?<!no )(?<!without )(?<!-)\b("
    r"interval callus formation|callus formation|interval callus|callus|"
    r"interval healing|healing|healed|non-?union|delayed union|mal-?union|"
    r"united|remodell?ed|old|acute"
    r")\b",
    re.IGNORECASE,
)

# Requirements A.4. Each position word is the key of a part in bones.json.
PART_WORDS = {
    "proximal": r"proximal",
    "distal": r"distal",
    "shaft": r"mid-?shaft|mid|shaft|diaphysis|diaphyseal",
    "metaphysis": r"metaphysis|metaphyseal",
    "head": r"head",
    "neck": r"neck",
    "base": r"base",
    "condyle": r"condyle|condylar",
    "styloid": r"styloid",
    "olecranon": r"olecranon",
    "waist": r"waist",
    "hook": r"hook",
    "center": r"center",
    "body": r"body",
    "glenoid": r"glenoid",
    "acromion": r"acromion|acromial",
    "ilium": r"ilium|iliac",
    "ischium": r"ischium|ischial",
    "pubis": r"pubis|pubic",
    "acetabulum": r"acetabulum|acetabular",
    "plateau": r"plateau",
    "medial_malleolus": r"medial malleolus",
    "lateral_malleolus": r"lateral malleolus",
    "dome": r"dome",
    "tuberosity": r"tuberosity",
    "anterior": r"anterior",
}

# A word like "radial" or "ulnar" can name a direction or a nearby structure.
NOT_THE_BONE_AFTER = re.compile(
    r"\s+(?:aspect|side|border|margin|deviation|nerve|artery|vein|ligament|"
    r"collateral|tendon|translation|displacement|angulation|tilt|bursa)\b",
    re.IGNORECASE,
)
BONE_INTACT_AFTER = re.compile(
    r"^(?:\s+\w+){0,2}?\s*(?:is |are |appears? |remains? )?"
    r"(?:intact|normal|unremarkable)\b",
    re.IGNORECASE,
)

# Requirements A.3: bones the app doesn't cover. A finding here gets no marker.
OUTSIDE_COVERAGE = re.compile(
    r"\b(ribs?|costal|vertebrae?|vertebral|spine|spinal|lumbar|thoracic|cervical|"
    r"sacrum|sacral|coccyx|coccygeal|tailbone|skull|cranial|calvarial|calvarium|"
    r"mandible|mandibular|maxilla|maxillary|nasal|facial|orbital|zygomatic|"
    r"temporal bone|sternum|sternal|breastbone|hyoid|odontoid|sesamoid|"
    r"[CTL]\d{1,2})\b",
    re.IGNORECASE,
)

# A region, or a group of bones, that doesn't say which bone (S2.4).
REGIONS = re.compile(
    r"\b(wrist|ankle|hand|foot|elbow|knee|shoulder|hip|fingers?|toes?|thumb|"
    r"digits?|forearm|arm|leg|thigh|heel|phalanx|phalanges|phalangeal|"
    r"metacarpals?|metatarsals?|carpals?|tarsals?)\b",
    re.IGNORECASE,
)

# Requirements A.4: fingers and toes are numbered from the thumb or big toe.
ORDINALS = {
    "first": 1,
    "1st": 1,
    "second": 2,
    "2nd": 2,
    "third": 3,
    "3rd": 3,
    "fourth": 4,
    "4th": 4,
    "fifth": 5,
    "5th": 5,
}
HAND_NAMES = {
    "thumb": 1,
    "index": 2,
    "middle": 3,
    "long": 3,
    "ring": 4,
    "little": 5,
    "small": 5,
    "pinky": 5,
}
FOOT_NAMES = {"great": 1, "big": 1, "hallux": 1, "little": 5, "small": 5}

# Lines in a report header whose dates aren't the exam's (S1.2).
NOT_EXAM_DATE_LINE = re.compile(
    r"\b(dob|birth|born|signed|dictated|transcribed|printed|reported|verified|"
    r"finalized|accession|mrn|compar\w*|prior)\b",
    re.IGNORECASE,
)
