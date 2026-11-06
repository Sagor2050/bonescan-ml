import { expect, test } from 'vitest'
import catalog from '../../public/shared/bones.json'
import type { Bone } from '../viewer/bones.ts'
import type { SavedFinding } from '../workspace/reportStore.ts'
import { reportBones } from './reportBones.ts'

const bones = catalog as unknown as Bone[]
const finding = (bone: string, side: SavedFinding['side']) =>
  ({ bone, side }) as SavedFinding

test('names each bone once, with its side', () => {
  expect(
    reportBones(
      [finding('radius', 'left'), finding('radius', 'left')],
      bones,
    ),
  ).toEqual(['left radius'])
})

test('keeps the two sides apart', () => {
  expect(
    reportBones([finding('radius', 'left'), finding('radius', 'right')], bones),
  ).toEqual(['left radius', 'right radius'])
})

test('a finding with no side names the bone alone', () => {
  expect(reportBones([finding('radius', '')], bones)).toEqual(['radius'])
})

test('a finding with no known bone adds nothing', () => {
  expect(reportBones([finding('', '')], bones)).toEqual([])
})
