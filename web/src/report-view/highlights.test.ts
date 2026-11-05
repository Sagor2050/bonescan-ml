import { describe, expect, test } from 'vitest'
import b1Pasted from '../../../tests/fixtures/read-b1-pasted.json'
import b1Pdf from '../../../tests/fixtures/read-b1-pdf.json'
import { parseReadResponse } from '../findings/parse.ts'
import { pageHighlights, textSegments } from './highlights.ts'

describe('pageHighlights', () => {
  const [finding] = parseReadResponse(b1Pdf).findings
  const saved = [{ ...finding, id: 'a' }]

  test('gives every box of the finding’s wording on that page', () => {
    const highlights = pageHighlights(saved, 1)
    expect(highlights).toHaveLength(3)
    expect(highlights[0].findingId).toBe('a')
    expect(highlights[0].box).toEqual([130.67, 135.28, 444.9, 146.28])
  })

  test('gives nothing for another page', () => {
    expect(pageHighlights(saved, 2)).toEqual([])
  })

  test('gives nothing for pasted wording or no wording', () => {
    const pasted = parseReadResponse(b1Pasted).findings[0]
    expect(pageHighlights([{ ...pasted, id: 'a' }], 1)).toEqual([])
    expect(pageHighlights([{ id: 'a', wording: [] }], 1)).toEqual([])
  })
})

describe('textSegments', () => {
  const response = parseReadResponse(b1Pasted)
  const saved = [{ ...response.findings[0], id: 'a' }]

  test('joining the pieces gives back the exact report text', () => {
    const segments = textSegments(response.text, saved)
    expect(segments.map((segment) => segment.text).join('')).toBe(response.text)
  })

  test('marks the wording from both Findings and Impression', () => {
    const marked = textSegments(response.text, saved).filter(
      (segment) => segment.findingId,
    )
    expect(marked.map((segment) => segment.findingId)).toEqual(['a', 'a'])
    expect(marked[1].text).toBe('Mildly angulated distal left radius fracture.')
  })

  const range = (start: number, end: number) => ({
    start,
    end,
    text: '',
  })

  test('the first finding keeps words that two findings claim', () => {
    const segments = textSegments('abcdef', [
      { id: 'a', wording: [range(0, 3)] },
      { id: 'b', wording: [range(1, 4)] },
    ])
    expect(segments).toEqual([
      { text: 'abc', findingId: 'a' },
      { text: 'def', findingId: null },
    ])
  })

  test('sorts ranges and ignores any outside the text', () => {
    const segments = textSegments('abcdef', [
      { id: 'b', wording: [range(4, 5)] },
      { id: 'a', wording: [range(0, 1)] },
      { id: 'c', wording: [range(4, 99)] },
    ])
    expect(segments.map((segment) => segment.text).join('')).toBe('abcdef')
    expect(segments.filter((segment) => segment.findingId)).toHaveLength(2)
  })

  test('a report with no wording is one plain piece', () => {
    expect(textSegments('abc', [])).toEqual([{ text: 'abc', findingId: null }])
  })
})
