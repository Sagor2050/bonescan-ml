import { FINDING_FIELDS, isFinding } from '../findings/parse.ts'
import {
  inExamOrder,
  type SavedFinding,
  type SavedReport,
} from '../workspace/reportStore.ts'

// Reports a patient shared through a link, as anyone with the link sees them
// (S10.3). The link's token is 32 random bytes in base64url with no padding.
const TOKEN = /^[A-Za-z0-9_-]{43}$/

export function isShareToken(token: string) {
  return TOKEN.test(token)
}

export type SharedReportsResult =
  | { status: 'unavailable' }
  | { status: 'ready'; reports: SavedReport[] }

// What GET /api/shared/:token sends for an active link. Every field is listed
// here, and nothing else in the response is kept, so a field the server should
// never have sent, such as the owner's id or a file path, can't reach the page.
//
// {
//   reports: [{
//     id, source, raw_text, exam_date, exam_date_source, added_at,
//     confirmed, file_url, scan_image_urls,
//     findings: [{ id, position, ...the reader's finding fields }]
//   }]
// }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isText(value: unknown): value is string {
  return typeof value === 'string'
}

function parseFinding(value: unknown, reportId: string): SavedFinding {
  if (!isObject(value) || !isText(value.id) || typeof value.position !== 'number') {
    throw new Error('A shared finding is in the wrong format.')
  }
  const finding = Object.fromEntries(
    FINDING_FIELDS.map((field) => [field, value[field]]),
  )
  if (!isFinding(finding)) {
    throw new Error('A shared finding is in the wrong format.')
  }
  return { ...finding, id: value.id, report_id: reportId, position: value.position }
}

function parseReport(value: unknown): SavedReport {
  if (
    !isObject(value) ||
    !isText(value.id) ||
    (value.source !== 'pdf' && value.source !== 'pasted') ||
    !isText(value.raw_text) ||
    !isText(value.exam_date) ||
    (value.exam_date_source !== 'report' &&
      value.exam_date_source !== 'patient') ||
    !isText(value.added_at) ||
    typeof value.confirmed !== 'boolean' ||
    !(value.file_url === null || isText(value.file_url)) ||
    !Array.isArray(value.scan_image_urls) ||
    !value.scan_image_urls.every(isText) ||
    !Array.isArray(value.findings)
  ) {
    throw new Error('A shared report is in the wrong format.')
  }
  const id = value.id
  return {
    id,
    source: value.source,
    file_path: '',
    raw_text: value.raw_text,
    exam_date: value.exam_date,
    exam_date_source: value.exam_date_source,
    added_at: value.added_at,
    findings: value.findings
      .map((finding) => parseFinding(finding, id))
      .sort((a, b) => a.position - b.position),
    shared: {
      confirmed: value.confirmed,
      fileUrl: value.file_url,
      scanImageUrls: value.scan_image_urls,
    },
  }
}

export function parseSharedReports(value: unknown): SavedReport[] {
  if (!isObject(value) || !Array.isArray(value.reports)) {
    throw new Error('The shared reports are in the wrong format.')
  }
  return inExamOrder(value.reports.map(parseReport))
}

// Reads the reports as they are now, never a saved copy, so changes the patient
// makes show on the next load. Sends no cookies or sign-in, so it gives the same
// result signed in or out. Every way a link can stop working gets the same 404,
// so the page can't tell them apart either.
export async function loadSharedReports(
  token: string,
  fetchFn: typeof fetch = fetch,
): Promise<SharedReportsResult> {
  if (!isShareToken(token)) return { status: 'unavailable' }

  const response = await fetchFn(`/api/shared/${token}`, {
    method: 'GET',
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    headers: { Accept: 'application/json' },
  })
  if (response.status === 404) return { status: 'unavailable' }
  if (!response.ok) throw new Error('The shared reports could not be loaded.')

  const reports = parseSharedReports(await response.json())
  return reports.length > 0
    ? { status: 'ready', reports }
    : { status: 'unavailable' }
}
