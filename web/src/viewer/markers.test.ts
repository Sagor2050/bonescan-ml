import { describe, expect, test } from 'vitest'
import catalog from '../../public/shared/bones.json'
import b1 from '../../../tests/fixtures/read-b1-pdf.json'
import b2 from '../../../tests/fixtures/read-b2-pasted.json'
import { parseReadResponse } from '../findings/parse.ts'
import type { Finding } from '../findings/types.ts'
import type { SavedFinding } from '../workspace/reportStore.ts'
import type { Bone } from './bones.ts'
import { labelPlacement, markersFor } from './markers.ts'

const bones = catalog as unknown as Bone[]

function radiusLeft() {
  const bone = bones.find((candidate) => candidate.id === 'radius_left')
  if (!bone) throw new Error('No radius_left')
  return bone
}

function saved(finding: Partial<Finding>, id = 'finding-1'): SavedFinding {
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
    report_id: 'report-1',
    position: 0,
    ...finding,
  }
}

function savedSample(sample: unknown) {
  return parseReadResponse(sample).findings.map((finding, index) =>
    saved(finding, `finding-${index}`),
  )
}

describe('the Appendix B reports', () => {
  test('B.1 gives one marker, on the left radius at its distal end', () => {
    const markers = markersFor(savedSample(b1), bones)
    expect(markers).toHaveLength(1)
    expect(markers[0].boneId).toBe('radius_left')
    expect(markers[0].point).toEqual(radiusLeft().parts.distal)
    expect(markers[0].certainty).toBe('certain')
  })

  test('B.2 gives one marker, on the same bone', () => {
    const markers = markersFor(savedSample(b2), bones)
    expect(markers).toHaveLength(1)
    expect(markers[0].boneId).toBe('radius_left')
  })

  test('only B.2 carries a healing status, in the report’s words', () => {
    expect(markersFor(savedSample(b1), bones)[0].healing).toEqual([])
    expect(markersFor(savedSample(b2), bones)[0].healing).toEqual([
      'Healing: “interval callus formation”, “healing”',
    ])
  })
})

describe('where a marker goes', () => {
  test('one finding on each of the 126 bones gives 126 markers, one each', () => {
    const findings = bones.map((bone, index) =>
      saved({ bone: bone.bone, side: bone.side }, `finding-${index}`),
    )
    const markers = markersFor(findings, bones)
    expect(markers.map((marker) => marker.boneId)).toEqual(
      bones.map((bone) => bone.id),
    )
  })

  test('a named part puts the marker on that part’s point', () => {
    const [marker] = markersFor([saved({ part: ['styloid'] })], bones)
    expect(marker.point).toEqual(radiusLeft().parts.styloid)
  })

  test('no named part marks the whole bone', () => {
    const [marker] = markersFor([saved({ part: [] })], bones)
    expect(marker.point).toBeNull()
  })

  test('a part the catalog does not have marks the whole bone, not a guess', () => {
    const [marker] = markersFor([saved({ part: ['no_such_part'] })], bones)
    expect(marker.point).toBeNull()
  })

  test('the right side uses the right bone’s own point', () => {
    const [marker] = markersFor([saved({ side: 'right', part: ['distal'] })], bones)
    expect(marker.boneId).toBe('radius_right')
    expect(marker.point?.[0]).toBeLessThan(0)
  })
})

describe('findings that get no marker', () => {
  test.each([
    ['outside coverage', { bone: '', side: '', status: 'outside_coverage' }],
    ['side not stated', { side: '', status: 'side_not_stated' }],
    ['bone not stated', { bone: '', status: 'bone_not_stated' }],
    ['a bone the catalog does not have', { bone: 'sacrum' }],
  ] as [string, Partial<Finding>][])('%s', (_name, fields) => {
    expect(markersFor([saved(fields)], bones)).toEqual([])
  })
})

describe('what a marker says', () => {
  test('names the bone both ways and gives the patient’s side', () => {
    const [marker] = markersFor([saved({})], bones)
    expect(marker.boneName).toBe('radius (forearm bone, thumb side)')
    expect(marker.sideLabel).toBe('Your left side')
  })

  test('labels a certain and an uncertain finding differently', () => {
    const [certain] = markersFor([saved({ certainty: 'certain' })], bones)
    const [uncertain] = markersFor([saved({ certainty: 'uncertain' })], bones)
    expect(certain.title).toBe('Fracture')
    expect(uncertain.title).toBe('Possible fracture')
  })

  test('says when the patient entered the finding', () => {
    const [marker] = markersFor([saved({ entered_by_patient: true })], bones)
    expect(marker.enteredByPatient).toBe(true)
  })

  test('two findings on the same spot still get a marker each, stacked', () => {
    const markers = markersFor(
      [saved({ part: ['distal'] }, 'a'), saved({ part: ['distal'] }, 'b')],
      bones,
    )
    expect(markers.map((marker) => marker.stackIndex)).toEqual([0, 1])
  })
})

describe('where a label goes', () => {
  test('points away from the middle when there is room', () => {
    expect(labelPlacement(0.2, 800).goesLeft).toBe(false)
    expect(labelPlacement(-0.2, 800).goesLeft).toBe(true)
  })

  test('narrows to fit before the edge of the view', () => {
    const { goesLeft, maxWidth } = labelPlacement(0.36, 450)
    expect(goesLeft).toBe(false)
    expect(maxWidth).toBeLessThan(450 / 2 - 0.36 * (450 / 2))
  })

  test('points inward only when the outside is too tight', () => {
    expect(labelPlacement(0.9, 450).goesLeft).toBe(true)
    expect(labelPlacement(-0.9, 450).goesLeft).toBe(false)
  })

  test('never grows past its widest size', () => {
    expect(labelPlacement(0, 2000).maxWidth).toBe(208)
  })
})

describe('a label keeping its side (#87)', () => {
  // Plays a marker's path across the view, feeding back the side it chose, and
  // counts the times the label jumps.
  function jumps(path: number[], viewWidth: number) {
    let side: boolean | undefined
    let count = 0
    for (const x of path) {
      const { goesLeft } = labelPlacement(x, viewWidth, side)
      if (side !== undefined && goesLeft !== side) count += 1
      side = goesLeft
    }
    return count
  }

  // The camera easing back and forth a little across a spot.
  const wobble = (around: number, by: number) =>
    Array.from({ length: 40 }, (_, step) => around + (step % 2 ? by : -by))

  test.each([320, 450, 800])(
    'stays put as a marker wobbles around the middle of a %ipx view',
    (viewWidth) => {
      expect(jumps(wobble(0, 0.01), viewWidth)).toBe(0)
    },
  )

  test('stays put as a marker wobbles where the outer side runs out of room', () => {
    const viewWidth = 450
    // 110px left of the edge, past the 20px gap: where the side choice changes.
    const edge = 1 - (2 * 130) / viewWidth
    expect(jumps(wobble(edge, 0.01), viewWidth)).toBe(0)
  })

  test('still moves to the outer side once a marker has clearly crossed', () => {
    const viewWidth = 800
    const first = labelPlacement(-0.3, viewWidth)
    expect(first.goesLeft).toBe(true)
    const after = labelPlacement(0.5, viewWidth, first.goesLeft)
    expect(after.goesLeft).toBe(false)
  })

  test('a kept side still fits inside the view', () => {
    const viewWidth = 320
    for (const side of [true, false]) {
      for (let x = -0.9; x <= 0.9; x += 0.05) {
        const { goesLeft, maxWidth } = labelPlacement(x, viewWidth, side)
        const room =
          ((goesLeft ? 1 + x : 1 - x) * viewWidth) / 2 - 20
        expect(maxWidth).toBeLessThanOrEqual(room + 0.001)
        expect(maxWidth).toBeGreaterThan(0)
      }
    }
  })

  test('with no side yet, a label points outward as before', () => {
    expect(labelPlacement(-0.5, 800).goesLeft).toBe(true)
    expect(labelPlacement(0.5, 800).goesLeft).toBe(false)
  })
})
