import type { SupabaseClient } from '@supabase/supabase-js'
import { setDraftReport } from '../add-report/draftReport.ts'
import { supabase } from './supabase.ts'

// Every message here is written in advance. Supabase's own error text is never
// shown, and none of them says whether an email address has an account (NFR8).
const NOT_SET_UP = "Accounts aren't set up on this copy of the app."
const TRY_AGAIN = 'Something went wrong. Please try again.'

export const MIN_PASSWORD_LENGTH = 8

type Client = SupabaseClient | null

/** Create an account. Email confirmation means it can't be used until confirmed. */
export async function createAccount(
  email: string,
  password: string,
  client: Client = supabase,
): Promise<void> {
  if (!client) throw new Error(NOT_SET_UP)
  const { error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/reports` },
  })
  if (error) {
    throw new Error(
      error.code === 'weak_password'
        ? 'Please choose a stronger password.'
        : TRY_AGAIN,
    )
  }
}

export async function signIn(
  email: string,
  password: string,
  client: Client = supabase,
): Promise<void> {
  if (!client) throw new Error(NOT_SET_UP)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (!error) return
  if (error.code === 'email_not_confirmed') {
    throw new Error(
      'Please confirm your email address first, using the link we sent you.',
    )
  }
  throw new Error(
    error.code === 'invalid_credentials'
      ? "That email address and password don't match."
      : TRY_AGAIN,
  )
}

/** Send a link for choosing a new password (S6.2). */
export async function requestPasswordReset(
  email: string,
  client: Client = supabase,
): Promise<void> {
  if (!client) throw new Error(NOT_SET_UP)
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw new Error(TRY_AGAIN)
}

export async function setNewPassword(
  password: string,
  client: Client = supabase,
): Promise<void> {
  if (!client) throw new Error(NOT_SET_UP)
  const { error } = await client.auth.updateUser({ password })
  if (error) {
    throw new Error(
      error.code === 'weak_password' || error.code === 'same_password'
        ? 'Please choose a different, stronger password.'
        : 'This link may have expired. Please ask for a new one.',
    )
  }
}

/**
 * Sign out and leave nothing behind (S6.2). The full page load clears everything
 * the app holds in memory, as signing out removes the session from the browser.
 */
export async function signOut(
  client: Client = supabase,
  leave: () => void = () => window.location.replace('/'),
): Promise<void> {
  setDraftReport(null)
  await client?.auth.signOut({ scope: 'local' })
  leave()
}
