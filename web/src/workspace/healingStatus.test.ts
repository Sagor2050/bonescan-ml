import { describe, expect, test } from 'vitest'
import b1 from '../../../tests/fixtures/read-b1-pdf.json'
import b2 from '../../../tests/fixtures/read-b2-pdf.json'
import { parseReadResponse } from '../findings/parse.ts'
import { healingLines } from './healingStatus.ts'

describe('healingLines', () => {
  test('B.1 has no healing words, so it shows no status', () => {
    const [finding] = parseReadResponse(b1).findings
    expect(healingLines(finding.healing_words)).toEqual([])
  })

  test('B.2 shows the Healing label with the report’s own words', () => {
    const [finding] = parseReadResponse(b2).findings
    expect(healingLines(finding.healing_words)).toEqual([
      'Healing: “interval callus formation”, “healing”',
    ])
  })

  test.each([
    ['acute', 'New'],
    ['healing', 'Healing'],
    ['callus formation', 'Healing'],
    ['interval healing', 'Healing'],
    ['healed', 'Healed'],
    ['united', 'Healed'],
    ['remodeled', 'Healed'],
    ['old', 'Healed'],
    ['nonunion', 'Not healing'],
    ['delayed union', 'Not healing'],
    ['malunion', 'Healed out of line'],
  ])('labels “%s” as %s, as Requirements A.6 does', (word, label) => {
    expect(healingLines([word])).toEqual([`${label}: “${word}”`])
  })

  test('matches a whole phrase, so a longer word is not mistaken for a label', () => {
    expect(healingLines(['non-united'])).toEqual(['Report says: “non-united”'])
    expect(healingLines(['not healed'])).toEqual(['Report says: “not healed”'])
  })

  test('quotes a word A.6 has no label for instead of guessing one', () => {
    expect(healingLines(['callus'])).toEqual(['Report says: “callus”'])
  })

  test('shows both when the words point two ways, rather than choosing', () => {
    expect(healingLines(['acute', 'old'])).toEqual([
      'New: “acute”',
      'Healed: “old”',
    ])
  })

  test('keeps the wording it was given, whatever its case', () => {
    expect(healingLines(['Healing'])).toEqual(['Healing: “Healing”'])
  })
})
