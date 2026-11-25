import { describe, expect, test, vi } from 'vitest'
import {
  OWNER_EMAIL,
  OWNER_ID,
  sharedResponse,
  TOKEN,
} from './sharedReports.fixture.ts'
import {
  isShareToken,
  loadSharedReports,
  parseSharedReports,
} from './sharedReports.ts'

function respond(status: number, body: unknown = {}) {
  return vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
}

describe('isShareToken', () => {
  test('takes 32 bytes in base64url with no padding', () => {
    expect(isShareToken(TOKEN)).toBe(true)
  })

  test.each([
    ['too short', TOKEN.slice(1)],
    ['too long', `${TOKEN}A`],
    ['padded', `${TOKEN.slice(1)}=`],
    ['plain base64', `${TOKEN.slice(2)}+/`],
    ['a path', `../${TOKEN.slice(3)}`],
  ])('refuses one that is %s', (_name, token) => {
    expect(isShareToken(token)).toBe(false)
  })
})

describe('parseSharedReports', () => {
  test('puts the reports in exam order', () => {
    const reports = parseSharedReports(sharedResponse())
    expect(reports.map((report) => report.exam_date)).toEqual([
      '2026-09-14',
      '2026-10-12',
    ])
  })

  test('keeps nothing about the owner, even when the server sends it', () => {
    const reports = parseSharedReports(sharedResponse())
    const kept = JSON.stringify(reports)
    expect(kept).not.toContain(OWNER_ID)
    expect(kept).not.toContain(OWNER_EMAIL)
    for (const report of reports) {
      expect(report.file_path).toBe('')
      expect(Object.keys(report).sort()).toEqual([
        'added_at',
        'exam_date',
        'exam_date_source',
        'file_path',
        'findings',
        'id',
        'raw_text',
        'shared',
        'source',
      ])
    }
  })

  test('keeps each report’s findings, files, and confirmed flag', () => {
    const [b1, b2] = parseSharedReports(sharedResponse({ b2Confirmed: false }))
    expect(b1.findings[0]).toMatchObject({
      id: 'shared-b1-finding-1',
      report_id: 'shared-b1',
      bone: 'radius',
      side: 'left',
    })
    expect(b1.shared).toEqual({
      confirmed: true,
      fileUrl: null,
      scanImageUrls: [],
    })
    expect(b2.shared?.confirmed).toBe(false)
  })

  test('refuses a response in the wrong format', () => {
    const response = sharedResponse()
    response.reports[0].findings[0].side = 'both'
    expect(() => parseSharedReports(response)).toThrow()
    expect(() => parseSharedReports({})).toThrow()
  })
})

describe('loadSharedReports', () => {
  test('asks for the link’s reports with a GET that sends no sign-in', async () => {
    const fetchFn = respond(200, sharedResponse())
    const result = await loadSharedReports(TOKEN, fetchFn)

    expect(result.status).toBe('ready')
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`/api/shared/${TOKEN}`)
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    })
    expect(init.body).toBeUndefined()
  })

  test('a 404 means the link is unavailable', async () => {
    expect(await loadSharedReports(TOKEN, respond(404))).toEqual({
      status: 'unavailable',
    })
  })

  test('a link with no reports left is unavailable', async () => {
    expect(
      await loadSharedReports(TOKEN, respond(200, { reports: [] })),
    ).toEqual({ status: 'unavailable' })
  })

  test('a token that could never be real is unavailable without asking', async () => {
    const fetchFn = respond(200, sharedResponse())
    expect(await loadSharedReports('not-a-token', fetchFn)).toEqual({
      status: 'unavailable',
    })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  test('a server error is a failure, not a dead link', async () => {
    await expect(loadSharedReports(TOKEN, respond(500))).rejects.toThrow()
  })
})
