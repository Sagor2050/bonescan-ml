import type { SupabaseClient } from '@supabase/supabase-js'
import { renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import {
  setDraftReport,
  useDraftReport,
  type DraftReport,
} from '../add-report/draftReport.ts'
import { createAccount, signIn, signOut } from './auth.ts'

function client(auth: Record<string, unknown>) {
  return { auth } as unknown as SupabaseClient
}

const failing = (code: string) => async () => ({ error: { code } })

describe('messages', () => {
  test('a wrong password never shows Supabase’s own text', async () => {
    const c = client({ signInWithPassword: failing('invalid_credentials') })
    await expect(signIn('a@b.co', 'x', c)).rejects.toThrow("don't match")
  })

  test('an unconfirmed email asks the patient to confirm it', async () => {
    const c = client({ signInWithPassword: failing('email_not_confirmed') })
    await expect(signIn('a@b.co', 'x', c)).rejects.toThrow('confirm your email')
  })

  test('with no Supabase project it says accounts are not set up', async () => {
    await expect(createAccount('a@b.co', 'x', null)).rejects.toThrow('set up')
  })
})

test('a new account returns to the app after confirming', async () => {
  const signUp = vi.fn(async () => ({ error: null }))
  await createAccount('a@b.co', 'long enough', client({ signUp }))
  expect(signUp).toHaveBeenCalledWith({
    email: 'a@b.co',
    password: 'long enough',
    options: { emailRedirectTo: `${window.location.origin}/reports` },
  })
})

test('signing out clears the unsaved report and reloads the page', async () => {
  setDraftReport({ text: 'fictional' } as DraftReport)
  const remove = vi.fn(async () => ({ error: null }))
  const leave = vi.fn()

  await signOut(client({ signOut: remove }), leave)

  expect(renderHook(() => useDraftReport()).result.current).toBeNull()
  expect(remove).toHaveBeenCalledWith({ scope: 'local' })
  expect(leave).toHaveBeenCalled()
})
