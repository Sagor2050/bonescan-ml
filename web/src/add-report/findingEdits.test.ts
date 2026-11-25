import { describe, expect, test } from 'vitest'
import type { DraftFinding } from './draftReport.ts'
import { newFinding, repeatedFindings, sameFracture } from './findingEdits.ts'

function finding(key: string, fields: Partial<DraftFinding> = {}): DraftFinding {
  return {
    ...newFinding(),
    key,
    bone: 'distal_phalanx_foot_5',
    side: 'left',
    status: 'placed',
    ...fields,
  }
}

describe('sameFracture', () => {
  test('the same bone, side, and part is the same fracture', () => {
    expect(sameFracture(finding('a'), finding('b'))).toBe(true)
  })

  test('parts in another order are the same part', () => {
    expect(
      sameFracture(
        finding('a', { bone: 'radius', part: ['distal', 'shaft'] }),
        finding('b', { bone: 'radius', part: ['shaft', 'distal'] }),
      ),
    ).toBe(true)
  })

  test.each<[string, Partial<DraftFinding>]>([
    ['side', { side: 'right' }],
    ['no side', { side: '', status: 'side_not_stated' }],
    ['part', { part: ['distal'] }],
    ['bone', { bone: 'distal_phalanx_foot_4' }],
  ])('a different %s is a different fracture', (_, change) => {
    expect(sameFracture(finding('a'), finding('b', change))).toBe(false)
  })

  test('findings with no bone chosen never match', () => {
    const outside = { bone: '', side: '' as const, status: 'outside_coverage' as const }
    expect(sameFracture(finding('a', outside), finding('b', outside))).toBe(false)
  })
})

describe('repeatedFindings', () => {
  test('names each repeat with the number of the finding it repeats', () => {
    const findings = [
      finding('a'),
      finding('b', { side: 'right' }),
      finding('c'),
      finding('d', { side: 'right' }),
    ]
    expect(repeatedFindings(findings)).toEqual(
      new Map([
        ['c', 1],
        ['d', 2],
      ]),
    )
  })

  test('different fractures repeat nothing', () => {
    expect(
      repeatedFindings([finding('a'), finding('b', { part: ['base'] })]).size,
    ).toBe(0)
  })
})
