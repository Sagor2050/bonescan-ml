import type { Session } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { supabase } from './supabase.ts'

// Who's signed in, for the whole app. With Supabase not configured, as in tests
// and early development, there are no accounts at all.
export type SessionState =
  | { status: 'no-accounts' }
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: Session }

const READER_URL = import.meta.env.VITE_READER_URL as string | undefined

let state: SessionState = supabase ? { status: 'loading' } : { status: 'no-accounts' }
let started = false
const listeners = new Set<() => void>()

function update(session: Session | null) {
  const wasSignedIn = state.status === 'signed-in'
  state = session ? { status: 'signed-in', session } : { status: 'signed-out' }
  // The reader's free hosting can take up to a minute to wake, so wake it as soon
  // as the patient signs in (Plan, Milestone 4).
  if (session && !wasSignedIn && READER_URL) {
    fetch(`${READER_URL}/health`).catch(() => {})
  }
  listeners.forEach((listener) => listener())
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  if (supabase && !started) {
    started = true
    supabase.auth.onAuthStateChange((_event, session) => update(session))
  }
  return () => {
    listeners.delete(onChange)
  }
}

export function useSession() {
  return useSyncExternalStore(subscribe, () => state)
}
