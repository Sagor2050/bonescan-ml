// The findings format shared with the reader (Plan B.2).
//
// docs/reader-contract.md describes it. reader/app/contract.py is the same
// format in Python, and both are tested against tests/fixtures/. Changing it
// needs agreement from both the web app and the reader sides.

export type Side = 'left' | 'right' | ''
export type Certainty = 'certain' | 'uncertain'
export type Status =
  | 'placed'
  | 'outside_coverage'
  | 'side_not_stated'
  | 'bone_not_stated'
export type RefusalCode = 'not_pdf' | 'too_large' | 'too_many_pages' | 'no_text'

/** [x0, top, x1, bottom] in PDF points from the top-left of the displayed page. */
export type Box = [number, number, number, number]

/** A piece of report wording on a PDF page. */
export interface PdfWording {
  page: number
  boxes: Box[]
  text: string
}

/** A piece of pasted report wording, as a character range in the report text. */
export interface TextWording {
  start: number
  end: number
  text: string
}

export type Wording = PdfWording | TextWording

export interface Finding {
  /** A bones.json `bone`, such as radius or metacarpal_5. Empty if not stated. */
  bone: string
  side: Side
  /** Keys of the bone's `parts` in bones.json. Empty means the whole bone. */
  part: string[]
  type_words: string[]
  certainty: Certainty
  healing_words: string[]
  status: Status
  wording: Wording[]
  entered_by_patient: boolean
}

export interface ReadResponse {
  text: string
  /** YYYY-MM-DD when the report states exactly one exam date, otherwise null. */
  exam_date: string | null
  /** The dates to choose between when there is not exactly one. */
  candidate_dates: string[]
  findings: Finding[]
}

export interface Refusal {
  refusal: RefusalCode
  message: string
}

export function isPdfWording(wording: Wording): wording is PdfWording {
  return 'boxes' in wording
}

/** The model node that holds a finding's bone, or null if it can't be placed. */
export function boneId(finding: Finding): string | null {
  if (finding.status !== 'placed' || !finding.bone || !finding.side) return null
  return `${finding.bone}_${finding.side}`
}
