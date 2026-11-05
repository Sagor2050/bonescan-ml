import { describe, expect, test } from 'vitest'
import bones from '../../public/shared/bones.json'
import b1Pasted from '../../../tests/fixtures/read-b1-pasted.json'
import b1Pdf from '../../../tests/fixtures/read-b1-pdf.json'
import b2Pasted from '../../../tests/fixtures/read-b2-pasted.json'
import b2Pdf from '../../../tests/fixtures/read-b2-pdf.json'
import { isRefusal, parseReadResponse } from './parse.ts'
import { boneId, isPdfWording } from './types.ts'

const samples = { b1Pasted, b1Pdf, b2Pasted, b2Pdf }

describe.each(Object.entries(samples))('sample %s', (_name, sample) => {
  test('passes the format check', () => {
    expect(parseReadResponse(sample).findings).toHaveLength(1)
  })

  test('points at a bone in the model', () => {
    const [finding] = parseReadResponse(sample).findings
    expect(bones.map((bone) => bone.id)).toContain(boneId(finding))
  })
})

test('a PDF sample has boxes and a pasted sample has character ranges', () => {
  expect(parseReadResponse(b1Pdf).findings[0].wording.every(isPdfWording)).toBe(
    true,
  )
  expect(
    parseReadResponse(b1Pasted).findings[0].wording.some(isPdfWording),
  ).toBe(false)
})

test('refuses a finding with an unknown field', () => {
  const [finding] = b1Pdf.findings
  const bad = { ...b1Pdf, findings: [{ ...finding, guess: true }] }
  expect(() => parseReadResponse(bad)).toThrow()
})

test('refuses a finding with an unknown status', () => {
  const [finding] = b1Pdf.findings
  const bad = { ...b1Pdf, findings: [{ ...finding, status: 'maybe' }] }
  expect(() => parseReadResponse(bad)).toThrow()
})

test('a finding that is not placed has no bone to mark', () => {
  const [finding] = parseReadResponse(b1Pdf).findings
  expect(boneId({ ...finding, status: 'side_not_stated', side: '' })).toBeNull()
})

test('recognizes a refusal', () => {
  expect(isRefusal({ refusal: 'too_large', message: 'Too big.' })).toBe(true)
  expect(isRefusal({ refusal: 'too_big', message: 'Too big.' })).toBe(false)
})
