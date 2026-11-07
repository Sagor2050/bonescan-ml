import { AuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { readReport } from './reader.ts'

afterEach(() => vi.unstubAllGlobals())

function clientWhere(getUser: () => Promise<unknown>) {
  return {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: 'fictional-token' } },
      }),
      getUser,
    },
  } as unknown as SupabaseClient
}

const stillSignedIn = async () => ({ data: { user: { id: 'u1' } }, error: null })

function readerRefuses() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{"detail":"Sign in first."}', { status: 401 })),
  )
}

async function messageFor(client: SupabaseClient | null) {
  const result = await readReport({ text: 'Fictional report.' }, client)
  if (result.kind !== 'failed') throw new Error(`expected failed, got ${result.kind}`)
  return result.message
}

describe('when the reader refuses the sign-in', () => {
  test('a good sign-in means the service is at fault, not the patient', async () => {
    readerRefuses()
    const message = await messageFor(clientWhere(stillSignedIn))
    expect(message).toContain("isn't working right now")
    expect(message).toContain("Signing in again won't help")
  })

  test('an ended sign-in still asks the patient to sign in again', async () => {
    readerRefuses()
    const ended = async () => ({
      data: { user: null },
      error: { name: 'AuthApiError', status: 403 },
    })
    expect(await messageFor(clientWhere(ended))).toBe(
      'Please sign in again, then add your report.',
    )
  })

  test('with Supabase out of reach too, it never blames the sign-in', async () => {
    readerRefuses()
    const unreachable = async () => ({
      data: { user: null },
      error: new AuthRetryableFetchError('down', 503),
    })
    expect(await messageFor(clientWhere(unreachable))).toContain(
      "couldn't reach the service",
    )
  })

  test('with no Supabase project it asks the patient to sign in', async () => {
    readerRefuses()
    expect(await messageFor(null)).toBe(
      'Please sign in again, then add your report.',
    )
  })
})

test('sends the sign-in token, and asks Supabase only after a refused sign-in', async () => {
  const reader = vi.fn(
    async () => new Response('not json', { status: 500 }),
  )
  vi.stubGlobal('fetch', reader)
  const getUser = vi.fn(stillSignedIn)

  await readReport({ text: 'Fictional report.' }, clientWhere(getUser))

  const [, request] = reader.mock.calls[0] as unknown as [string, RequestInit]
  expect(request.headers).toEqual({ Authorization: 'Bearer fictional-token' })
  expect(getUser).not.toHaveBeenCalled()
})
