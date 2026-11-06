import type { Certainty } from '../findings/types.ts'
import type { Bone } from '../viewer/bones.ts'
import {
  CERTAINTY_TITLES,
  markersFor,
  withStackIndexes,
  type MarkerLook,
  type MarkerSpec,
} from '../viewer/markers.ts'
import { formatExamDate } from '../workspace/examDate.ts'
import { healingLines } from '../workspace/healingStatus.ts'
import type { SavedFinding, SavedReport } from '../workspace/reportStore.ts'
import { sameInjury } from './sameInjury.ts'

export type Presence = 'both' | 'earlier' | 'later'

// One injury across the two reports. A report can list more than one finding on
// it, because the rule matches by bone and side only (OQ3).
export type ComparedInjury = {
  presence: Presence
  earlier: SavedFinding[]
  later: SavedFinding[]
}

export type Comparison = {
  earlier: SavedReport
  later: SavedReport
  injuries: ComparedInjury[]
}

export const PRESENCE_ORDER: Presence[] = ['both', 'earlier', 'later']

export const PRESENCE_TITLES: Record<Presence, string> = {
  both: 'In both reports',
  earlier: 'Only in the earlier report',
  later: 'Only in the later report',
}

const HOLLOW_FILL = '#ffffff'

const PRESENCE_LOOKS: Record<
  Presence,
  MarkerLook & { hollowGlyph: string }
> = {
  both: { shape: 'round', fill: '#8b3fd9', glyph: '●', hollowGlyph: '○' },
  earlier: { shape: 'cube', fill: '#3b82f6', glyph: '■', hollowGlyph: '□' },
  later: { shape: 'cone', fill: '#f97316', glyph: '▲', hollowGlyph: '△' },
}

// The shape says which reports a finding is in, and a hollow shape says the
// finding is uncertain, so neither rests on color (NFR12).
export function presenceLook(
  presence: Presence,
  certainty: Certainty,
): MarkerLook {
  const { shape, fill, glyph, hollowGlyph } = PRESENCE_LOOKS[presence]
  return certainty === 'certain'
    ? { shape, fill, glyph }
    : { shape, fill: HOLLOW_FILL, glyph: hollowGlyph }
}

export function compareFindings(
  earlier: SavedFinding[],
  later: SavedFinding[],
): ComparedInjury[] {
  const injuries: Omit<ComparedInjury, 'presence'>[] = []

  function add(finding: SavedFinding, from: 'earlier' | 'later') {
    const match = injuries.find((injury) =>
      sameInjury(injury.earlier[0] ?? injury.later[0], finding),
    )
    if (match) {
      match[from].push(finding)
    } else {
      injuries.push({
        earlier: from === 'earlier' ? [finding] : [],
        later: from === 'later' ? [finding] : [],
      })
    }
  }
  earlier.forEach((finding) => add(finding, 'earlier'))
  later.forEach((finding) => add(finding, 'later'))

  return injuries.map((injury) => ({
    ...injury,
    presence:
      injury.earlier.length === 0
        ? 'later'
        : injury.later.length === 0
          ? 'earlier'
          : 'both',
  }))
}

// Which of two chosen reports came first follows the timeline's own order, so
// `reports` must already be in exam order. The patient can choose them either
// way round. Null if either is gone, or both are the same report.
export function comparedReports(
  reports: SavedReport[],
  firstId: string,
  secondId: string,
): Comparison | null {
  const first = reports.findIndex((report) => report.id === firstId)
  const second = reports.findIndex((report) => report.id === secondId)
  if (first === -1 || second === -1 || first === second) return null
  const earlier = reports[Math.min(first, second)]
  const later = reports[Math.max(first, second)]
  return {
    earlier,
    later,
    injuries: compareFindings(earlier.findings, later.findings),
  }
}

// Both reports on one skeleton (Plan M5). Findings of one injury at the same
// spot share a marker, while one at another spot on the bone gets its own, so no
// finding is hidden. The marker carries the later report's certainty, and the
// list beside the model gives each report's.
export function comparisonMarkers(comparison: Comparison, bones: Bone[]) {
  const examDates = new Map<string, string>()
  for (const report of [comparison.earlier, comparison.later]) {
    for (const finding of report.findings) {
      examDates.set(finding.id, formatExamDate(report.exam_date))
    }
  }

  const markers: MarkerSpec[] = []
  for (const injury of comparison.injuries) {
    const findings = [...injury.earlier, ...injury.later]
    const atSpots = new Map<string, MarkerSpec[]>()
    for (const marker of markersFor(findings, bones)) {
      const spot = marker.point?.join(',') ?? 'whole'
      atSpots.set(spot, [...(atSpots.get(spot) ?? []), marker])
    }

    for (const atSpot of atSpots.values()) {
      const latest = atSpot[atSpot.length - 1]
      markers.push({
        ...latest,
        look: presenceLook(injury.presence, latest.certainty),
        title: PRESENCE_TITLES[injury.presence],
        subtitle: CERTAINTY_TITLES[latest.certainty],
        healing: atSpot.flatMap((marker) => {
          const finding = findings.find(({ id }) => id === marker.findingId)
          return healingLines(finding?.healing_words ?? []).map(
            (line) => `${examDates.get(marker.findingId)}: ${line}`,
          )
        }),
        enteredByPatient: atSpot.some((marker) => marker.enteredByPatient),
      })
    }
  }
  return withStackIndexes(markers)
}
