// The public, read-only side of share links (S10.3): what GET /api/shared/:token
// and GET /api/shared/:token/reports/:index/file answer. It needs no account, so
// it works through a ShareStore that the route gives it. Nothing here can change
// a report or a link, and nothing it sends names the patient.

// 32 random bytes in base64url with no padding.
const TOKEN = /^[A-Za-z0-9_-]{43}$/

export const LINK_UNAVAILABLE = 'This link is no longer available.'

// On every answer, including errors, so a revoked link never lingers in a cache
// or leaks through a Referer header.
const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
}

// The finding fields a viewer sees: the reader's fields (Plan B.2) and the
// finding's own id and place in the report. Never report_id.
const FINDING_FIELDS = [
  'id',
  'position',
  'bone',
  'side',
  'part',
  'type_words',
  'certainty',
  'healing_words',
  'status',
  'wording',
  'entered_by_patient',
] as const

// The findings table's row, which has more than a viewer may see.
type StoredFinding = Record<string, unknown>

// A report as the database holds it. file_path names the owner's account, so it
// only ever reaches downloadFile.
export type StoredReport = {
  id: string
  source: 'pdf' | 'pasted'
  file_path: string
  raw_text: string
  exam_date: string
  exam_date_source: 'report' | 'patient'
  added_at: string
  findings: StoredFinding[]
}

export interface ShareStore {
  // The id of the link with this token, if the link is active. Unknown, expired,
  // revoked, and emptied links all give null.
  activeLinkId(token: string): Promise<string | null>
  // The link's reports that still exist, with their findings.
  linkedReports(linkId: string): Promise<StoredReport[]>
  downloadFile(filePath: string): Promise<ArrayBuffer | null>
}

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: { ...PRIVATE_HEADERS, ...headers },
  })
}

// One answer for every link that doesn't work, so a viewer can't tell why.
function unavailable() {
  return json(404, { error: LINK_UNAVAILABLE })
}

// Exam date first, then the order they were added (S5.1).
function inExamOrder(reports: StoredReport[]) {
  return [...reports].sort(
    (a, b) =>
      a.exam_date.localeCompare(b.exam_date) ||
      a.added_at.localeCompare(b.added_at),
  )
}

function fileUrl(token: string, index: number) {
  return `/api/shared/${token}/reports/${index}/file`
}

// Builds each report field by field, so a column added to the database later
// isn't sent by accident.
function viewerReport(token: string, report: StoredReport, index: number) {
  return {
    id: report.id,
    source: report.source,
    raw_text: report.raw_text,
    exam_date: report.exam_date,
    exam_date_source: report.exam_date_source,
    added_at: report.added_at,
    // Nothing is stored until the patient confirms it (Plan B.3).
    confirmed: true,
    file_url:
      report.source === 'pdf' && report.file_path
        ? fileUrl(token, index)
        : null,
    // Scan images (F7) aren't built yet.
    scan_image_urls: [],
    findings: [...report.findings]
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map((finding) =>
        Object.fromEntries(FINDING_FIELDS.map((field) => [field, finding[field]])),
      ),
  }
}

async function linkReports(token: string, store: ShareStore) {
  const linkId = await store.activeLinkId(token)
  if (!linkId) return null
  const reports = inExamOrder(await store.linkedReports(linkId))
  return reports.length > 0 ? reports : null
}

type Route =
  | { kind: 'reports'; token: string }
  | { kind: 'file'; token: string; index: string }

function route(url: string): Route | null {
  const parts = new URL(url).pathname.split('/').filter(Boolean)
  if (parts[0] !== 'api' || parts[1] !== 'shared') return null
  if (parts.length === 3) return { kind: 'reports', token: parts[2] }
  if (parts.length === 6 && parts[3] === 'reports' && parts[5] === 'file') {
    return { kind: 'file', token: parts[2], index: parts[4] }
  }
  return null
}

async function answer(found: Route, store: ShareStore) {
  const reports = await linkReports(found.token, store)
  if (!reports) return unavailable()

  if (found.kind === 'reports') {
    return json(200, {
      reports: reports.map((report, index) =>
        viewerReport(found.token, report, index),
      ),
    })
  }

  const report = /^\d+$/.test(found.index) ? reports[Number(found.index)] : undefined
  if (!report || report.source !== 'pdf' || !report.file_path) return unavailable()
  const file = await store.downloadFile(report.file_path)
  if (!file) return unavailable()
  return new Response(file, {
    headers: {
      ...PRIVATE_HEADERS,
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="report.pdf"',
    },
  })
}

// Read-only by construction: GET is the only method, and the store has no way
// to write. The store is made only once a request needs it, so a malformed
// token or a write is turned away without touching the database.
export async function handleSharedRequest(
  request: Request,
  getStore: () => ShareStore,
): Promise<Response> {
  if (request.method !== 'GET') {
    return json(405, { error: 'Shared reports can only be viewed.' }, { Allow: 'GET' })
  }
  const found = route(request.url)
  if (!found || !TOKEN.test(found.token)) return unavailable()

  try {
    return await answer(found, getStore())
  } catch {
    // Nothing about the link or its reports goes to the logs.
    console.error('A shared link could not be read.')
    return json(500, { error: 'These reports could not be loaded.' })
  }
}
