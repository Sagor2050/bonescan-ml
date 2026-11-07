import { isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../account/supabase.ts'
import { isRefusal, parseReadResponse } from '../findings/parse.ts'
import type { ReadResponse, Refusal } from '../findings/types.ts'

const READER_URL =
  (import.meta.env.VITE_READER_URL as string | undefined) ??
  'http://localhost:8000'

export type ReportInput = { file: File } | { text: string }

export type ReadResult =
  | { kind: 'read'; response: ReadResponse }
  | { kind: 'refused'; refusal: Refusal }
  | { kind: 'failed'; message: string }

const CANT_REACH =
  "We couldn't reach the service that reads reports. Please try again in a minute."
const SIGN_IN_AGAIN = 'Please sign in again, then add your report.'
const NOT_WORKING =
  "The service that reads reports isn't working right now, so your report wasn't read. Signing in again won't help. Please try again later."

// The reader refuses with a 401 when a sign-in has ended, and also when its own
// settings stop it from checking sign-ins (#86). Only Supabase can tell these
// apart, and only the first is something the patient can fix.
async function whyTheReaderRefused(client: SupabaseClient | null) {
  if (!client) return SIGN_IN_AGAIN
  const { data, error } = await client.auth.getUser()
  if (data.user) return NOT_WORKING
  return isAuthRetryableFetchError(error) ? CANT_REACH : SIGN_IN_AGAIN
}

/** Send a report to the reader, which returns proposed findings and forgets it. */
export async function readReport(
  input: ReportInput,
  client: SupabaseClient | null = supabase,
): Promise<ReadResult> {
  const form = new FormData()
  if ('file' in input) form.append('file', input.file)
  else form.append('text', input.text)

  const headers: Record<string, string> = {}
  const token = (await client?.auth.getSession())?.data.session?.access_token
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${READER_URL}/read`, {
      method: 'POST',
      headers,
      body: form,
    })
  } catch {
    return { kind: 'failed', message: CANT_REACH }
  }

  if (response.status === 401) {
    return { kind: 'failed', message: await whyTheReaderRefused(client) }
  }
  try {
    const body: unknown = await response.json()
    if (response.status === 422 && isRefusal(body)) {
      return { kind: 'refused', refusal: body }
    }
    if (response.ok) {
      return { kind: 'read', response: parseReadResponse(body) }
    }
  } catch {
    return { kind: 'failed', message: CANT_REACH }
  }
  return { kind: 'failed', message: CANT_REACH }
}
