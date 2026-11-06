import { describe, expect, test } from 'vitest'
import catalog from '../../public/shared/bones.json'
import b1 from '../../../tests/fixtures/read-b1-pdf.json'
import b2 from '../../../tests/fixtures/read-b2-pdf.json'
import { parseReadResponse } from '../findings/parse.ts'
import type { Finding } from '../findings/types.ts'
import type { Bone } from '../viewer/bones.ts'
import type { SavedFinding, SavedReport } from '../workspace/reportStore.ts'
import {
  compareFindings,
  comparedReports,
  comparisonMarkers,
  presenceLook,
} from './comparison.ts'
import { sameInjury } from './sameInjury.ts'

const bones = catalog as unknown as Bone[]

function saved(fields: Partial<Finding>, id: string): SavedFinding {
  return {
    bone: 'radius',
    side: 'left',
    part: [],
    type_words: [],
    certainty: 'certain',
    healing_words: [],
    status: 'placed',
    wording: [],
    entered_by_patient: false,
    id,
    report_id: 'report',
    position: 0,
    ...fields,
  }
}

function report(
  id: string,
  examDate: string,
  findings: SavedFinding[],
): SavedReport {
  return {
    id,
    source: 'pasted',
    file_path: '',
    raw_text: '',
    exam_date: examDate,
    exam_date_source: 'patient',
    added_at: '2026-09-15T12:00:00Z',
    findings,
  }
}

function appendix(id: string, sample: unknown, examDate: string) {
  return report(
    id,
    examDate,
    parseReadResponse(sample).findings.map((finding, index) =>
      saved(finding, `${id}-${index}`),
    ),
  )
}

describe('sameInjury', () => {
  test('is the same bone and the same side (OQ3)', () => {
    const left = { bone: 'radius', side: 'left' } as const
    expect(sameInjury(left, { bone: 'radius', side: 'left' })).toBe(true)
    expect(sameInjury(left, { bone: 'radius', side: 'right' })).toBe(false)
    expect(sameInjury(left, { bone: 'ulna', side: 'left' })).toBe(false)
  })

  test('a missing side or bone matches nothing, even another missing one', () => {
    const noSide = { bone: 'radius', side: '' } as const
    const noBone = { bone: '', side: 'left' } as const
    expect(sameInjury(noSide, noSide)).toBe(false)
    expect(sameInjury(noBone, noBone)).toBe(false)
  })
})

describe('compareFindings', () => {
  test('sorts findings into both, only earlier, and only later', () => {
    const injuries = compareFindings(
      [saved({}, 'radius-1'), saved({ bone: 'femur' }, 'femur-1')],
      [saved({}, 'radius-2'), saved({ bone: 'tibia' }, 'tibia-2')],
    )
    expect(
      injuries.map((injury) => [
        injury.presence,
        [...injury.earlier, ...injury.later].map(({ id }) => id),
      ]),
    ).toEqual([
      ['both', ['radius-1', 'radius-2']],
      ['earlier', ['femur-1']],
      ['later', ['tibia-2']],
    ])
  })

  test('the other side of the same bone is a different injury', () => {
    const [left, right] = compareFindings(
      [saved({ side: 'left' }, 'a')],
      [saved({ side: 'right' }, 'b')],
    )
    expect(left.presence).toBe('earlier')
    expect(right.presence).toBe('later')
  })

  test('every finding on a bone counts as in both when the later report has one', () => {
    const injuries = compareFindings(
      [saved({ part: ['distal'] }, 'a'), saved({ part: ['shaft'] }, 'b')],
      [saved({ part: ['distal'] }, 'c')],
    )
    expect(injuries).toHaveLength(1)
    expect(injuries[0].presence).toBe('both')
  })

  test('findings with no side stay separate', () => {
    const noSide = { side: '', status: 'side_not_stated' } as const
    const injuries = compareFindings(
      [saved(noSide, 'a')],
      [saved(noSide, 'b')],
    )
    expect(injuries.map((injury) => injury.presence)).toEqual([
      'earlier',
      'later',
    ])
  })
})

describe('comparedReports', () => {
  const reports = [
    report('a', '2026-07-01', []),
    report('b', '2026-08-01', []),
    report('c', '2026-09-01', []),
  ]

  test('follows exam order whichever way round they were chosen', () => {
    const comparison = comparedReports(reports, 'c', 'a')
    expect(comparison?.earlier.id).toBe('a')
    expect(comparison?.later.id).toBe('c')
  })

  test('two reports with the same date keep the timeline’s order', () => {
    const sameDate = [
      report('first-added', '2026-07-01', []),
      report('second-added', '2026-07-01', []),
    ]
    expect(
      comparedReports(sameDate, 'second-added', 'first-added')?.earlier.id,
    ).toBe('first-added')
  })

  test('is null for a report that is gone, or a report with itself', () => {
    expect(comparedReports(reports, 'a', 'gone')).toBeNull()
    expect(comparedReports(reports, 'a', 'a')).toBeNull()
  })
})

describe('comparisonMarkers', () => {
  test('Appendix B: one marker, in both, with healing words only from B.2', () => {
    const comparison = comparedReports(
      [
        appendix('b1', b1, '2026-09-14'),
        appendix('b2', b2, '2026-10-12'),
      ],
      'b1',
      'b2',
    )
    if (!comparison) throw new Error('No comparison')
    const markers = comparisonMarkers(comparison, bones)
    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({
      boneId: 'radius_left',
      title: 'In both reports',
      subtitle: 'Fracture',
      healing: ['Oct 12, 2026: Healing: “interval callus formation”, “healing”'],
    })
    expect(markers[0].look.shape).toBe('round')
  })

  test('each kind of finding has its own shape, with or without certainty', () => {
    const shapes = (['both', 'earlier', 'later'] as const).map(
      (presence) => presenceLook(presence, 'certain').shape,
    )
    expect(new Set(shapes).size).toBe(3)
    expect(presenceLook('later', 'uncertain').shape).toBe(
      presenceLook('later', 'certain').shape,
    )
    expect(presenceLook('later', 'uncertain').glyph).not.toBe(
      presenceLook('later', 'certain').glyph,
    )
    expect(presenceLook('later', 'uncertain').fill).not.toBe(
      presenceLook('later', 'certain').fill,
    )
  })

  test('the same injury at another spot on the bone keeps both markers', () => {
    const comparison = comparedReports(
      [
        report('a', '2026-07-01', [saved({ part: ['distal'] }, 'a-1')]),
        report('b', '2026-08-01', [saved({ part: ['proximal'] }, 'b-1')]),
      ],
      'a',
      'b',
    )
    if (!comparison) throw new Error('No comparison')
    const markers = comparisonMarkers(comparison, bones)
    expect(markers.map((marker) => marker.findingId)).toEqual(['a-1', 'b-1'])
    expect(markers.every((marker) => marker.title === 'In both reports')).toBe(
      true,
    )
  })

  test('a finding that can’t be placed gets no marker', () => {
    const comparison = comparedReports(
      [
        report('a', '2026-07-01', [
          saved({ side: '', status: 'side_not_stated' }, 'a-1'),
        ]),
        report('b', '2026-08-01', []),
      ],
      'a',
      'b',
    )
    if (!comparison) throw new Error('No comparison')
    expect(comparisonMarkers(comparison, bones)).toEqual([])
  })

  test('a patient-entered finding stays labeled when it shares a marker', () => {
    const comparison = comparedReports(
      [
        report('a', '2026-07-01', [
          saved({ part: ['distal'], entered_by_patient: true }, 'a-1'),
        ]),
        report('b', '2026-08-01', [saved({ part: ['distal'] }, 'b-1')]),
      ],
      'a',
      'b',
    )
    if (!comparison) throw new Error('No comparison')
    expect(comparisonMarkers(comparison, bones)[0].enteredByPatient).toBe(true)
  })
})
