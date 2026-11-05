import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// The one Supabase client. It's null when the project isn't configured, as in
// tests and in development before web/.env is filled in.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

export const REPORTS_BUCKET = 'reports'

/** Where a report's original PDF is kept (Plan B.1). */
export function reportFilePath(userId: string, reportId: string) {
  return `${userId}/${reportId}.pdf`
}
