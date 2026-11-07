import type { SupabaseClient } from '@supabase/supabase-js'
import { setDraftReport } from '../add-report/draftReport.ts'
import { REPORTS_BUCKET, supabase } from './supabase.ts'

// Every message here is written in advance. Supabase's own error text is never
// shown, and none of them says whether an email address has an account (NFR8).
const NOT_SET_UP = "Accounts aren't set up on this copy of the app."
const TRY_AGAIN = 'Something went wrong. Please try again.'

export const MIN_PASSWORD_LENGTH = 8

type Client = SupabaseClient | null

/** Signing in failed only because the email address isn't confirmed yet. */
export class EmailNotConfirmedError extends Error {}

function afterConfirming() {
  return `${window.location.origin}/reports`
}

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
    options: { emailRedirectTo: afterConfirming() },
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
    throw new EmailNotConfirmedError(
      'Please confirm your email address first, using the newest link we sent you.',
    )
  }
  throw new Error(
    error.code === 'invalid_credentials'
      ? "That email address and password don't match."
      : TRY_AGAIN,
  )
}

/**
 * Send a new confirmation link, which replaces any earlier one. Supabase answers
 * the same way for an address with no account or one already confirmed (NFR8).
 */
export async function resendConfirmation(
  email: string,
  client: Client = supabase,
): Promise<void> {
  if (!client) throw new Error(NOT_SET_UP)
  const { error } = await client.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: afterConfirming() },
  })
  if (error) {
    throw new Error(
      error.code === 'over_email_send_rate_limit'
        ? "We've sent too many emails for now. Please wait a while, then try again."
        : TRY_AGAIN,
    )
  }
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

// Every original file in the account's folder (Plan B.1). A page at a time, since
// a page can't list more than this. Storage reports no error when access rules
// stop a delete, so removing nothing counts as failing.
async function removeAllFiles(client: SupabaseClient, userId: string) {
  const files = client.storage.from(REPORTS_BUCKET)
  for (;;) {
    const { data: listed, error: listError } = await files.list(userId, {
      limit: 100,
    })
    if (listError) throw new Error(TRY_AGAIN)
    if (listed.length === 0) return

    const { data: removed, error } = await files.remove(
      listed.map((file) => `${userId}/${file.name}`),
    )
    if (error || removed.length === 0) throw new Error(TRY_AGAIN)
  }
}

/**
 * Delete the account and everything in it, for good (S6.3). Signing in again is
 * what proves it's the patient, and the database function checks that it just
 * happened. The files go first, because the account's sign-in is what allows
 * removing them. The database then removes the reports and findings with the
 * account. If a step fails, trying again picks up where this stopped.
 */
export async function deleteAccount(
  password: string,
  client: Client = supabase,
  leave?: () => void,
): Promise<void> {
  if (!client) throw new Error(NOT_SET_UP)
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser()
  if (userError || !user?.email) throw new Error(TRY_AGAIN)

  const { error: signInError } = await client.auth.signInWithPassword({
    email: user.email,
    password,
  })
  if (signInError) {
    throw new Error(
      signInError.code === 'invalid_credentials'
        ? "That password isn't right."
        : TRY_AGAIN,
    )
  }

  await removeAllFiles(client, user.id)

  const { error } = await client.rpc('delete_my_account')
  if (error) throw new Error(TRY_AGAIN)

  await signOut(client, leave)
}
