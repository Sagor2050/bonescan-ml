import { beforeEach, describe, expect, test } from 'vitest'
import {
  cameFromFailedEmailLink,
  isFailedEmailLink,
  showFailedEmailLink,
} from './emailLink.ts'

// What Supabase's verify endpoint returned for a token it wouldn't accept.
const FAILED =
  '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb='

describe('isFailedEmailLink', () => {
  test('recognizes what Supabase sends back', () => {
    expect(isFailedEmailLink(FAILED)).toBe(true)
  })

  test.each(['', '#', '#about', '#access_token=abc&type=signup'])(
    'leaves %j alone',
    (hash) => {
      expect(isFailedEmailLink(hash)).toBe(false)
    },
  )
})

describe('showFailedEmailLink', () => {
  beforeEach(() => window.history.replaceState(null, '', '/'))

  test.each(['/', '/reports', '/reset-password'])(
    'moves a failed link from %s to the sign-in screen',
    (path) => {
      window.history.replaceState(null, '', `${path}${FAILED}`)
      showFailedEmailLink()
      expect(window.location.pathname).toBe('/sign-in')
      expect(window.location.hash).toBe('')
      expect(cameFromFailedEmailLink()).toBe(true)
    },
  )

  test('leaves a link that worked for Supabase to read', () => {
    window.history.replaceState(null, '', '/reports#access_token=abc')
    showFailedEmailLink()
    expect(window.location.pathname).toBe('/reports')
    expect(window.location.hash).toBe('#access_token=abc')
    expect(cameFromFailedEmailLink()).toBe(false)
  })
})
