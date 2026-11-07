import { describe, expect, test } from 'vitest'
import catalog from '../../public/shared/bones.json'
import type { Bone } from './bones.ts'

const bones = catalog as unknown as Bone[]
const left = (name: string) => {
  const bone = bones.find((entry) => entry.id === `${name}_left`)
  if (!bone) throw new Error(`No ${name}_left`)
  return bone
}

const fingersAndToes = [1, 2, 3, 4, 5].flatMap((number) => [
  `metacarpal_${number}`,
  `metatarsal_${number}`,
])

describe('the marker points in bones.json', () => {
  test('each right point mirrors its left point across the body', () => {
    for (const bone of bones.filter((entry) => entry.side === 'left')) {
      const right = bones.find((entry) => entry.id === `${bone.bone}_right`)
      if (!right) throw new Error(`No ${bone.bone}_right`)
      expect(Object.keys(right.parts)).toEqual(Object.keys(bone.parts))
      for (const [part, [x, y, z]] of Object.entries(bone.parts)) {
        const [rx, ry, rz] = right.parts[part]
        expect(rx).toBeCloseTo(-x, 3)
        expect(ry).toBeCloseTo(y, 3)
        expect(rz).toBeCloseTo(z, 3)
      }
    }
  })

  test('the left side is the patient’s left, at +X', () => {
    for (const bone of bones.filter((entry) => entry.side === 'left')) {
      for (const [x] of Object.values(bone.parts)) {
        expect(x).toBeGreaterThan(0)
      }
    }
  })

  // The cases in #39 that would put a marker on the wrong part of the right bone.
  test.each(['femur', 'humerus', 'radius', 'fibula', ...fingersAndToes])(
    'the neck of the %s is not at its shaft',
    (name) => {
      const { parts } = left(name)
      expect(parts.neck).not.toEqual(parts.shaft)
    },
  )

  test.each(fingersAndToes)('the head of the %s is not at its base', (name) => {
    const { parts } = left(name)
    expect(parts.head).not.toEqual(parts.base)
  })

  // `distal` is the far part of the bone. The very tip has its own name.
  test.each([
    ['radius', 'styloid'],
    ['ulna', 'styloid'],
    ['humerus', 'condyle'],
    ['femur', 'condyle'],
    ['tibia', 'medial_malleolus'],
    ['fibula', 'lateral_malleolus'],
  ])('the distal %s sits above its %s', (name, tip) => {
    const { parts } = left(name)
    expect(parts.distal[1]).toBeGreaterThan(parts[tip][1])
  })

  test.each(['scapula', 'hip_bone', 'calcaneus', 'talus'])(
    'every named part of the %s has its own point',
    (name) => {
      const points = Object.values(left(name).parts).map((point) => point.join())
      expect(new Set(points).size).toBe(points.length)
    },
  )
})
