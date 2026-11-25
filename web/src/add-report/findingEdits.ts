import type { Finding, Side, Status } from '../findings/types.ts'
import { newFindingKey, type DraftFinding } from './draftReport.ts'

/** A finding the patient changes or adds gets its status from what it now says. */
function statusAfterEdit(bone: string, side: Side): Status {
  if (!bone) return 'bone_not_stated'
  return side ? 'placed' : 'side_not_stated'
}

type FindingEdit = Partial<Pick<Finding, 'bone' | 'side' | 'part'>>

/** Apply a patient's correction, which is then labeled as entered by them (S2.3). */
export function editFinding(
  finding: DraftFinding,
  edit: FindingEdit,
): DraftFinding {
  const next = { ...finding, ...edit }
  const untouchedOutside =
    finding.status === 'outside_coverage' && !next.bone
  return {
    ...next,
    status: untouchedOutside
      ? 'outside_coverage'
      : statusAfterEdit(next.bone, next.side),
    entered_by_patient: true,
  }
}

/** A finding the reader missed. It has no report wording to show (S4.2). */
export function newFinding(): DraftFinding {
  return {
    key: newFindingKey(),
    bone: '',
    side: '',
    part: [],
    type_words: [],
    certainty: 'certain',
    healing_words: [],
    status: 'bone_not_stated',
    wording: [],
    entered_by_patient: true,
  }
}

/**
 * Whether two findings name the same fracture: the same bone, side, and part. The
 * reader already makes these one finding (S2.1), so a report can't list one twice
 * (#111). Findings with no bone chosen can't be compared, so they never match.
 */
export function sameFracture(a: Finding, b: Finding) {
  const parts = (finding: Finding) => [...finding.part].sort().join()
  return (
    a.bone !== '' &&
    a.bone === b.bone &&
    a.side === b.side &&
    parts(a) === parts(b)
  )
}

/** Each finding that repeats an earlier one, by key, with the earlier one's number. */
export function repeatedFindings(findings: DraftFinding[]) {
  const repeats = new Map<string, number>()
  findings.forEach((finding, index) => {
    const first = findings
      .slice(0, index)
      .findIndex((other) => sameFracture(other, finding))
    if (first !== -1) repeats.set(finding.key, first + 1)
  })
  return repeats
}

export const REPEATED_FINDINGS =
  'Two findings are the same fracture. Change or remove one to save.'

// The reason a finding gets no marker (S2.4). Written in advance, never generated.
const STATUS_REASONS: Partial<Record<Status, string>> = {
  outside_coverage:
    "This is on a bone the app doesn't cover, so it won't be marked on the skeleton. It's still in your original report.",
  side_not_stated:
    "Your report doesn't say which side this is on. It won't be marked until you choose a side.",
  bone_not_stated:
    "Your report doesn't say which bone this is. It won't be marked until you choose a bone. Your care team can tell you which one if you're not sure.",
}

/** Why a finding gets no marker, or null if it gets one. */
export function noMarkerReason(finding: Finding): string | null {
  if (finding.status === 'placed') return null
  // A finding the patient added isn't from the report, so don't blame the report.
  if (finding.wording.length === 0) {
    return 'Choose a bone and a side to mark this on the skeleton.'
  }
  return STATUS_REASONS[finding.status] ?? null
}

/** What to call a finding that has no bone chosen. */
export function unplacedTitle(finding: Finding): string {
  return finding.status === 'outside_coverage'
    ? "A bone the app doesn't cover"
    : 'Bone not chosen'
}

/** Today's date where the patient is, as YYYY-MM-DD. */
export function localToday(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Why an exam date can't be saved, or null if it can (S1.2). */
export function examDateProblem(value: string, today: string): string | null {
  if (!value) return 'Enter the date of the exam.'
  if (value > today) return "The exam date can't be in the future."
  return null
}
