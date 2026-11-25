import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../account/supabase.ts'
import {
  DEFAULT_EXPIRY_DAYS,
  isExpiryDays,
  shareLinkState,
  shareUrl,
  type ExpiryDays,
  type NewShareLink,
  type ShareLink,
} from './shareLinks.ts'

// Patients only read share links directly, through row-level security. Every
// change goes through a database function that checks the patient owns the link
// and its reports (supabase/migrations/0003_share_links.sql).

type LinkRow = {
  id: string
  created_at: string
  expires_at: string | null
  revoked_at: string | null
  share_link_reports: { reports: { id: string; exam_date: string } | null }[]
}

// Without Supabase, development uses an in-memory stand-in, like the sample
// reports. Production builds leave it out.
async function sampleStore() {
  if (!import.meta.env.DEV) throw new Error('Sharing isn’t set up on this copy of the app.')
  return import('./sampleShareLinks.ts')
}

// expiresInDays left out means the patient's default expiry.
export async function createShareLink(
  reportIds: string[],
  expiresInDays?: ExpiryDays,
  client: SupabaseClient | null = supabase,
): Promise<NewShareLink> {
  if (!client) return (await sampleStore()).createSampleShareLink(reportIds, expiresInDays)

  const { data, error } = await client.rpc('create_share_link', {
    report_ids: reportIds,
    expires_in_days: expiresInDays ?? null,
    use_default_expiry: expiresInDays === undefined,
  })
  const row = (data as { id: string; token: string; expires_at: string | null }[] | null)?.[0]
  if (error || !row) throw new Error('The link could not be made. Please try again.')
  return { id: row.id, url: shareUrl(row.token), expiresAt: row.expires_at }
}

export function toShareLink(row: LinkRow, now = new Date()): ShareLink {
  const reports = row.share_link_reports
    .flatMap(({ reports }) => (reports ? [{ id: reports.id, examDate: reports.exam_date }] : []))
    .sort((a, b) => a.examDate.localeCompare(b.examDate))
  const link = {
    id: row.id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    reports,
  }
  return { ...link, state: shareLinkState(link, now) }
}

// Newest first.
export async function loadShareLinks(
  client: SupabaseClient | null = supabase,
): Promise<ShareLink[]> {
  if (!client) return (await sampleStore()).loadSampleShareLinks()

  const { data, error } = await client
    .from('share_links')
    .select('id, created_at, expires_at, revoked_at, share_link_reports(reports(id, exam_date))')
    .order('created_at', { ascending: false })
  if (error) throw new Error('Your shared links could not be loaded.')
  return (data as unknown as LinkRow[]).map((row) => toShareLink(row))
}

// The new expiry counts from now.
export async function changeShareLinkExpiry(
  linkId: string,
  expiresInDays: ExpiryDays,
  client: SupabaseClient | null = supabase,
): Promise<void> {
  if (!client) return (await sampleStore()).changeSampleShareLinkExpiry(linkId, expiresInDays)

  const { error } = await client.rpc('set_share_link_expiry', {
    link_id: linkId,
    expires_in_days: expiresInDays,
  })
  if (error) throw new Error('The expiry could not be changed. Please try again.')
}

export async function turnOffShareLink(
  linkId: string,
  client: SupabaseClient | null = supabase,
): Promise<void> {
  if (!client) return (await sampleStore()).turnOffSampleShareLink(linkId)

  const { error } = await client.rpc('revoke_share_link', { link_id: linkId })
  if (error) throw new Error('The link could not be turned off. Please try again.')
}

export async function loadDefaultShareExpiry(
  client: SupabaseClient | null = supabase,
): Promise<ExpiryDays> {
  if (!client) return (await sampleStore()).sampleDefaultExpiry()

  const { data, error } = await client.rpc('my_default_share_expiry')
  if (error) throw new Error('Your sharing settings could not be loaded.')
  return isExpiryDays(data) ? data : DEFAULT_EXPIRY_DAYS
}

export async function saveDefaultShareExpiry(
  days: ExpiryDays,
  client: SupabaseClient | null = supabase,
): Promise<void> {
  if (!client) return (await sampleStore()).setSampleDefaultExpiry(days)

  const { error } = await client.rpc('set_default_share_expiry', { days })
  if (error) throw new Error('Your default could not be saved. Please try again.')
}
