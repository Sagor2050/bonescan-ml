// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  handleSharedRequest,
  LINK_UNAVAILABLE,
  type ShareStore,
  type StoredReport,
} from './sharedReports.js'

// A stand-in for the database, holding the fictional Appendix B reports of one
// patient and one report of theirs that no link covers.

const OWNER_ID = '7d4c2f9e-0a3b-4e51-9c1d-2f6e8b7a5c40'
const OWNER_EMAIL = 'owner@example.com'
const PDF = new TextEncoder().encode('%PDF-1.4 fictional').buffer as ArrayBuffer

const token = (text: string) => Buffer.from(text.padEnd(32, '.')).toString('base64url')
const ACTIVE = token('an active link')
const NEVER_EXPIRES = token('a link that never expires')
const EXPIRED = token('an expired link')
const REVOKED = token('a revoked link')
const EMPTIED = token('a link whose reports are deleted')
const UNKNOWN = token('a link that was never made')

type Sample = { text: string; exam_date: string; findings: Record<string, unknown>[] }
const sample = (name: string) =>
  JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../../tests/fixtures', name), 'utf8'),
  ) as Sample

function stored(
  id: string,
  { text, exam_date, findings }: Sample,
  source: 'pdf' | 'pasted',
  addedAt: string,
): StoredReport & { user_id: string; owner_email: string } {
  return {
    id,
    user_id: OWNER_ID,
    owner_email: OWNER_EMAIL,
    source,
    file_path: source === 'pdf' ? `${OWNER_ID}/${id}.pdf` : '',
    raw_text: text,
    exam_date,
    exam_date_source: 'report',
    added_at: addedAt,
    // Out of order, so the answer has to sort them.
    findings: findings
      .map((finding, position) => ({
        ...finding,
        id: `${id}-finding-${position}`,
        report_id: id,
        position,
      }))
      .reverse(),
  }
}

const b1 = stored('report-b1', sample('read-b1-pdf.json'), 'pdf', '2026-10-13T10:00:00Z')
const b2 = stored('report-b2', sample('read-b2-pasted.json'), 'pasted', '2026-10-12T10:00:00Z')
const notShared = stored('report-private', sample('read-b2-pdf.json'), 'pdf', '2026-10-14T10:00:00Z')

const DAY = 24 * 60 * 60 * 1000
type Link = {
  id: string
  expiresAt: number | null
  revokedAt: number | null
  reports: StoredReport[]
}
const links = new Map<string, Link>([
  [ACTIVE, { id: 'link-active', expiresAt: Date.now() + DAY, revokedAt: null, reports: [b2, b1] }],
  [NEVER_EXPIRES, { id: 'link-forever', expiresAt: null, revokedAt: null, reports: [b2] }],
  [EXPIRED, { id: 'link-expired', expiresAt: Date.now() - DAY, revokedAt: null, reports: [b1] }],
  [REVOKED, { id: 'link-revoked', expiresAt: null, revokedAt: Date.now() - DAY, reports: [b1] }],
  [EMPTIED, { id: 'link-emptied', expiresAt: null, revokedAt: null, reports: [] }],
])

// The link state rule from the shared contract, as share_link_is_active has it.
function isActive(link: Link) {
  return (
    link.revokedAt === null &&
    (link.expiresAt === null || link.expiresAt > Date.now()) &&
    link.reports.length > 0
  )
}

let store: ShareStore & { [K in keyof ShareStore]: ReturnType<typeof vi.fn> }

beforeEach(() => {
  store = {
    activeLinkId: vi.fn(async (value: string) => {
      const link = links.get(value)
      return link && isActive(link) ? link.id : null
    }),
    linkedReports: vi.fn(async (id: string) =>
      [...links.values()].find((link) => link.id === id)?.reports ?? [],
    ),
    downloadFile: vi.fn(async (path: string) =>
      path === b1.file_path ? PDF : null,
    ),
  }
})

function request(path: string, method = 'GET') {
  return handleSharedRequest(
    new Request(`https://bonescan.example${path}`, { method }),
    () => store,
  )
}

async function everything(response: Response) {
  return {
    status: response.status,
    headers: [...response.headers.entries()],
    body: await response.text(),
  }
}

function expectPrivateHeaders(response: Response) {
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
  expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
}

describe('GET /api/shared/:token on an active link', () => {
  test('returns only the linked reports, in exam order', async () => {
    const response = await request(`/api/shared/${ACTIVE}`)
    expect(response.status).toBe(200)
    expectPrivateHeaders(response)

    const { reports } = await response.json()
    expect(reports.map((report: { id: string }) => report.id)).toEqual([
      'report-b1',
      'report-b2',
    ])
  })

  test('sends nothing about the owner', async () => {
    const response = await request(`/api/shared/${ACTIVE}`)
    const body = await response.text()
    expect(body).not.toContain(OWNER_ID)
    expect(body).not.toContain(OWNER_EMAIL)
    expect(body).not.toContain('file_path')
    expect(body).not.toContain('user_id')
    expect(body).not.toContain('report_id')
    expect(body).not.toContain(notShared.id)
  })

  test('sends each report with its findings, files, and confirmed flag', async () => {
    const response = await request(`/api/shared/${ACTIVE}`)
    const [first, second] = (await response.json()).reports
    expect(Object.keys(first).sort()).toEqual([
      'added_at',
      'confirmed',
      'exam_date',
      'exam_date_source',
      'file_url',
      'findings',
      'id',
      'raw_text',
      'scan_image_urls',
      'source',
    ])
    expect(first).toMatchObject({
      confirmed: true,
      file_url: `/api/shared/${ACTIVE}/reports/0/file`,
      scan_image_urls: [],
    })
    expect(second.file_url).toBeNull()
    expect(first.findings[0]).toMatchObject({
      id: 'report-b1-finding-0',
      position: 0,
      bone: 'radius',
      side: 'left',
    })
  })

  test('a link with no end date works', async () => {
    expect((await request(`/api/shared/${NEVER_EXPIRES}`)).status).toBe(200)
  })
})

describe('a link that does not work', () => {
  test('expired, revoked, emptied, unknown, and malformed tokens get the identical 404', async () => {
    const answers = await Promise.all(
      [EXPIRED, REVOKED, EMPTIED, UNKNOWN, 'not-a-token', `${ACTIVE}x`].map(
        async (value) => everything(await request(`/api/shared/${value}`)),
      ),
    )
    expect(answers[0].status).toBe(404)
    expect(JSON.parse(answers[0].body)).toEqual({ error: LINK_UNAVAILABLE })
    for (const answer of answers) expect(answer).toEqual(answers[0])
  })

  test('the 404 still carries the private headers', async () => {
    expectPrivateHeaders(await request(`/api/shared/${REVOKED}`))
  })

  test('a malformed token never reaches the database', async () => {
    await request('/api/shared/not-a-token')
    expect(store.activeLinkId).not.toHaveBeenCalled()
  })

  test('its file is not available either', async () => {
    const answer = await everything(
      await request(`/api/shared/${EXPIRED}/reports/0/file`),
    )
    expect(answer).toEqual(await everything(await request(`/api/shared/${UNKNOWN}`)))
    expect(store.downloadFile).not.toHaveBeenCalled()
  })
})

describe('writes', () => {
  test.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    '%s is refused on both routes without touching the database',
    async (method) => {
      for (const path of [
        `/api/shared/${ACTIVE}`,
        `/api/shared/${ACTIVE}/reports/0/file`,
      ]) {
        const response = await request(path, method)
        expect(response.status).toBe(405)
        expect(response.headers.get('Allow')).toBe('GET')
        expectPrivateHeaders(response)
      }
      expect(store.activeLinkId).not.toHaveBeenCalled()
    },
  )
})

describe('GET /api/shared/:token/reports/:index/file', () => {
  test('streams the original PDF without showing where it is stored', async () => {
    const response = await request(`/api/shared/${ACTIVE}/reports/0/file`)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expectPrivateHeaders(response)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(PDF))
    expect(store.downloadFile).toHaveBeenCalledWith(b1.file_path)

    const headers = [...response.headers.values()].join(' ')
    expect(headers).not.toContain(OWNER_ID)
    expect(headers).not.toContain(b1.id)
  })

  test('a pasted report, a missing file, or an index out of range is a 404', async () => {
    for (const index of ['1', '2', '-1', '0x0', 'abc']) {
      const response = await request(`/api/shared/${ACTIVE}/reports/${index}/file`)
      expect(response.status).toBe(404)
    }
    store.downloadFile.mockResolvedValueOnce(null)
    expect((await request(`/api/shared/${ACTIVE}/reports/0/file`)).status).toBe(404)
  })
})

test('a database error says nothing about the link', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  store.linkedReports.mockRejectedValueOnce(new Error(`no row for ${OWNER_ID}`))
  const response = await request(`/api/shared/${ACTIVE}`)
  expect(response.status).toBe(500)
  expectPrivateHeaders(response)
  expect(await response.text()).not.toContain(OWNER_ID)
  expect(String(vi.mocked(console.error).mock.calls)).not.toContain(OWNER_ID)
})
