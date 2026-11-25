import { loadSampleReports } from '../workspace/sampleReports.ts'
import {
  DEFAULT_EXPIRY_DAYS,
  shareLinkState,
  shareUrl,
  type ExpiryDays,
  type NewShareLink,
  type ShareLink,
} from './shareLinks.ts'

// Share links for the fictional sample reports, kept in memory for development
// only. They open nothing, because there is no database behind them.

type SampleLink = Omit<ShareLink, 'state'>

let links: SampleLink[] = []
let defaultExpiry: ExpiryDays = DEFAULT_EXPIRY_DAYS

function expiryFromNow(days: ExpiryDays) {
  return days === null ? null : new Date(Date.now() + days * 86_400_000).toISOString()
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

export async function createSampleShareLink(
  reportIds: string[],
  expiresInDays?: ExpiryDays,
): Promise<NewShareLink> {
  const reports = await loadSampleReports()
  const chosen = reports.filter((report) => reportIds.includes(report.id))
  if (chosen.length === 0 || chosen.length !== new Set(reportIds).size) {
    throw new Error('The link could not be made. Please try again.')
  }
  const link: SampleLink = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    expiresAt: expiryFromNow(expiresInDays === undefined ? defaultExpiry : expiresInDays),
    revokedAt: null,
    reports: chosen
      .map((report) => ({ id: report.id, examDate: report.exam_date }))
      .sort((a, b) => a.examDate.localeCompare(b.examDate)),
  }
  links = [link, ...links]
  return { id: link.id, url: shareUrl(randomToken()), expiresAt: link.expiresAt }
}

export async function loadSampleShareLinks(): Promise<ShareLink[]> {
  return links.map((link) => ({ ...link, state: shareLinkState(link) }))
}

function findOpen(linkId: string) {
  const link = links.find((entry) => entry.id === linkId)
  if (!link || link.revokedAt) throw new Error('This link can’t be changed.')
  return link
}

export async function changeSampleShareLinkExpiry(linkId: string, days: ExpiryDays) {
  findOpen(linkId).expiresAt = expiryFromNow(days)
}

export async function turnOffSampleShareLink(linkId: string) {
  findOpen(linkId).revokedAt = new Date().toISOString()
}

export async function sampleDefaultExpiry() {
  return defaultExpiry
}

export async function setSampleDefaultExpiry(days: ExpiryDays) {
  defaultExpiry = days
}
