import type { SupabaseClient } from '@supabase/supabase-js'
import { renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import {
  setDraftReport,
  useDraftReport,
  type DraftReport,
} from '../add-report/draftReport.ts'
import {
  createAccount,
  deleteAccount,
  EmailNotConfirmedError,
  resendConfirmation,
  signIn,
  signOut,
} from './auth.ts'

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
    const attempt = signIn('a@b.co', 'x', c)
    await expect(attempt).rejects.toThrow('confirm your email')
    await expect(attempt).rejects.toBeInstanceOf(EmailNotConfirmedError)
  })

  test('a wrong password is not mistaken for an unconfirmed email', async () => {
    const c = client({ signInWithPassword: failing('invalid_credentials') })
    await expect(signIn('a@b.co', 'x', c)).rejects.not.toBeInstanceOf(
      EmailNotConfirmedError,
    )
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

describe('sending a new confirmation link', () => {
  test('returns to the app after confirming, like the first link', async () => {
    const resend = vi.fn(async () => ({ error: null }))
    await resendConfirmation('a@b.co', client({ resend }))
    expect(resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'a@b.co',
      options: { emailRedirectTo: `${window.location.origin}/reports` },
    })
  })

  test('too many emails asks the patient to wait', async () => {
    const c = client({ resend: failing('over_email_send_rate_limit') })
    await expect(resendConfirmation('a@b.co', c)).rejects.toThrow('wait a while')
  })

  test('any other failure never shows Supabase’s own text', async () => {
    const c = client({ resend: failing('unexpected_failure') })
    await expect(resendConfirmation('a@b.co', c)).rejects.toThrow('try again')
  })

  test('with no Supabase project it says accounts are not set up', async () => {
    await expect(resendConfirmation('a@b.co', null)).rejects.toThrow('set up')
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

describe('deleting an account', () => {
  const USER = 'user-1'

  // Pages of files, as the storage folder would list them. Records the order of
  // the calls, because the files have to go before the account.
  function fake({
    pages = [[]] as string[][],
    signInError = null as { code: string } | null,
    listError = null as unknown,
    removeError = null as unknown,
    removesNothing = false,
    rpcError = null as unknown,
  } = {}) {
    const calls: string[] = []
    const left = [...pages]
    const remove = vi.fn(async (paths: string[]) => {
      calls.push('remove')
      if (removeError) return { data: null, error: removeError }
      if (removesNothing) return { data: [], error: null }
      left.shift()
      return { data: paths.map((name) => ({ name })), error: null }
    })
    const list = vi.fn(async () => {
      calls.push('list')
      if (listError) return { data: null, error: listError }
      return {
        data: (left[0] ?? []).map((name) => ({ name })),
        error: null,
      }
    })
    const signInWithPassword = vi.fn(async () => {
      calls.push('sign in')
      return { error: signInError }
    })
    const rpc = vi.fn(async () => {
      calls.push('delete account')
      return { error: rpcError }
    })
    const auth = {
      getUser: async () => ({
        data: { user: { id: USER, email: 'a@b.co' } },
        error: null,
      }),
      signInWithPassword,
      signOut: vi.fn(async () => {
        calls.push('sign out')
        return { error: null }
      }),
    }
    const c = {
      auth,
      rpc,
      storage: { from: vi.fn(() => ({ list, remove })) },
    } as unknown as SupabaseClient
    const leave = vi.fn()
    return { c, calls, remove, rpc, signInWithPassword, leave }
  }

  test('signs in again, removes the files, deletes the account, and leaves', async () => {
    const { c, calls, remove, rpc, signInWithPassword, leave } = fake({
      pages: [['one.pdf', 'two.pdf']],
    })

    await deleteAccount('secret', c, leave)

    expect(calls).toEqual([
      'sign in',
      'list',
      'remove',
      'list',
      'delete account',
      'sign out',
    ])
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'secret',
    })
    expect(remove).toHaveBeenCalledWith([`${USER}/one.pdf`, `${USER}/two.pdf`])
    expect(rpc).toHaveBeenCalledWith('delete_my_account')
    expect(leave).toHaveBeenCalled()
  })

  test('keeps going until no files are left', async () => {
    const { c, remove, leave } = fake({ pages: [['a.pdf'], ['b.pdf']] })

    await deleteAccount('secret', c, leave)

    expect(remove).toHaveBeenCalledTimes(2)
  })

  test('an account with no files is still deleted', async () => {
    const { c, remove, rpc, leave } = fake()

    await deleteAccount('secret', c, leave)

    expect(remove).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalled()
  })

  test('a wrong password deletes nothing', async () => {
    const { c, calls, leave } = fake({
      pages: [['a.pdf']],
      signInError: { code: 'invalid_credentials' },
    })

    await expect(deleteAccount('wrong', c, leave)).rejects.toThrow(
      "That password isn't right.",
    )

    expect(calls).toEqual(['sign in'])
    expect(leave).not.toHaveBeenCalled()
  })

  test.each([
    ['listing them fails', { listError: new Error('down') }],
    ['removing them fails', { removeError: new Error('down') }],
    ['access rules silently stop it', { removesNothing: true }],
  ])('keeps the account when %s', async (_name, problem) => {
    const { c, calls, leave } = fake({ pages: [['a.pdf']], ...problem })

    await expect(deleteAccount('secret', c, leave)).rejects.toThrow('try again')

    expect(calls).not.toContain('delete account')
    expect(leave).not.toHaveBeenCalled()
  })

  test('stays signed in when the database refuses', async () => {
    const { c, calls, leave } = fake({ rpcError: new Error('too old') })

    await expect(deleteAccount('secret', c, leave)).rejects.toThrow('try again')

    expect(calls).not.toContain('sign out')
    expect(leave).not.toHaveBeenCalled()
  })

  test('with no Supabase project it says accounts are not set up', async () => {
    await expect(deleteAccount('x', null)).rejects.toThrow('set up')
  })
})
