// Links a patient makes to share chosen reports (S10.1). The database keeps
// only a hash of each link's token, so a link's address is shown once, when it's
// made, and never again.

// What the patient must read and accept before any link is made.
export const SHARE_WARNING =
  'Anyone who has this link can view these reports until it expires or you turn it off.'

// How long a new link works for, in days. Null means it never expires.
export const EXPIRY_CHOICES = [1, 7, 14, 30, 90, null] as const
export type ExpiryDays = (typeof EXPIRY_CHOICES)[number]
export const DEFAULT_EXPIRY_DAYS: ExpiryDays = 30

export function expiryLabel(days: ExpiryDays) {
  if (days === null) return 'Never'
  return days === 1 ? '1 day' : `${days} days`
}

// For a <select>, whose values are strings.
export function expiryValue(days: ExpiryDays) {
  return days === null ? 'never' : String(days)
}

export function parseExpiry(value: string): ExpiryDays {
  return EXPIRY_CHOICES.find((days) => expiryValue(days) === value) ?? null
}

export function isExpiryDays(value: unknown): value is ExpiryDays {
  return EXPIRY_CHOICES.some((days) => days === value)
}

export type SharedReport = { id: string; examDate: string }

export type ShareLinkState = 'active' | 'expired' | 'turned_off'

export type ShareLink = {
  id: string
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  // Deleted reports drop out of every link.
  reports: SharedReport[]
  state: ShareLinkState
}

export type NewShareLink = { id: string; url: string; expiresAt: string | null }

// A link opens its reports only while it's on, hasn't expired, and still covers
// at least one report. The database's share_link_is_active() is the same rule.
export function shareLinkState(
  link: Pick<ShareLink, 'expiresAt' | 'revokedAt' | 'reports'>,
  now = new Date(),
): ShareLinkState {
  if (link.revokedAt !== null) return 'turned_off'
  if (link.expiresAt !== null && new Date(link.expiresAt) <= now) return 'expired'
  if (link.reports.length === 0) return 'expired'
  return 'active'
}

export function shareUrl(token: string, origin = window.location.origin) {
  return `${origin}/s/${token}`
}

// A link's created or expiry time as the patient reads it, such as "Nov 25, 2026".
export function formatShareDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
