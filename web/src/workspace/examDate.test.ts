import { expect, test } from 'vitest'
import { formatExamDate } from './examDate.ts'

test('shows the same calendar day it was given', () => {
  expect(formatExamDate('2026-09-14')).toBe('Sep 14, 2026')
  expect(formatExamDate('2026-01-01')).toBe('Jan 1, 2026')
})
