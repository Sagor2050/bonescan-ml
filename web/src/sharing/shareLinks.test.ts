import { expect, test } from 'vitest'
import {
  EXPIRY_CHOICES,
  expiryLabel,
  expiryValue,
  parseExpiry,
  shareLinkState,
  shareUrl,
} from './shareLinks.ts'

const now = new Date('2026-11-25T12:00:00Z')
const report = { id: 'r1', examDate: '2026-09-14' }

test('a link that is on, unexpired, and covers a report is active', () => {
  expect(
    shareLinkState({ revokedAt: null, expiresAt: '2026-11-26T00:00:00Z', reports: [report] }, now),
  ).toBe('active')
  expect(shareLinkState({ revokedAt: null, expiresAt: null, reports: [report] }, now)).toBe(
    'active',
  )
})

test('a link past its expiry is expired', () => {
  expect(
    shareLinkState({ revokedAt: null, expiresAt: '2026-11-25T12:00:00Z', reports: [report] }, now),
  ).toBe('expired')
})

test('a link whose reports were all deleted counts as expired', () => {
  expect(shareLinkState({ revokedAt: null, expiresAt: null, reports: [] }, now)).toBe('expired')
})

test('a turned-off link stays turned off, whatever its expiry', () => {
  expect(
    shareLinkState(
      { revokedAt: '2026-11-20T00:00:00Z', expiresAt: '2026-10-01T00:00:00Z', reports: [report] },
      now,
    ),
  ).toBe('turned_off')
})

test('the expiry choices are 1, 7, 14, 30, 90 days, or never', () => {
  expect(EXPIRY_CHOICES.map(expiryLabel)).toEqual([
    '1 day',
    '7 days',
    '14 days',
    '30 days',
    '90 days',
    'Never',
  ])
  for (const days of EXPIRY_CHOICES) expect(parseExpiry(expiryValue(days))).toBe(days)
})

test('a link address has the token after /s/', () => {
  expect(shareUrl('abc_-123', 'https://bonescan.example')).toBe('https://bonescan.example/s/abc_-123')
})
