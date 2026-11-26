import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { markerInfo } from './viewer.ts'

// S10.3. The public API doesn't exist in `npm run dev`, so these tests answer
// for it with the fictional Appendix B reports, the way it answers for a link.

const TOKEN = 'QSBmaWN0aW9uYWwgc2hhcmUgbGluayBmb3IgdGVzdHM'
const FILE_URL = `/api/shared/${TOKEN}/reports/0/file`
const fixture = (name: string) =>
  readFileSync(resolve(import.meta.dirname, '../../tests/fixtures', name))
const B1_PDF = fixture('report-b1.pdf')

type Sample = {
  text: string
  exam_date: string
  findings: Record<string, unknown>[]
}
const b1 = JSON.parse(fixture('read-b1-pdf.json').toString()) as Sample
const b2 = JSON.parse(fixture('read-b2-pasted.json').toString()) as Sample

function sharedReport(
  id: string,
  sample: Sample,
  source: 'pdf' | 'pasted',
  confirmed: boolean,
) {
  return {
    id,
    source,
    raw_text: sample.text,
    exam_date: sample.exam_date,
    exam_date_source: 'report',
    added_at: '2026-10-13T15:00:00Z',
    confirmed,
    file_url: source === 'pdf' ? FILE_URL : null,
    scan_image_urls: [],
    findings: sample.findings.map((finding, position) => ({
      ...finding,
      id: `${id}-finding-${position + 1}`,
      position,
    })),
  }
}

async function answerFor(page: Page, linkWorks: boolean) {
  await page.route('**/api/shared/**', (route) => {
    const url = new URL(route.request().url())
    if (!linkWorks || route.request().method() !== 'GET') {
      return route.fulfill({
        status: 404,
        json: { error: 'This link is no longer available.' },
      })
    }
    if (url.pathname === FILE_URL) {
      return route.fulfill({ contentType: 'application/pdf', body: B1_PDF })
    }
    return route.fulfill({
      json: {
        reports: [
          sharedReport('shared-b2', b2, 'pasted', false),
          sharedReport('shared-b1', b1, 'pdf', true),
        ],
      },
    })
  })
}

async function waitForModel(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Boolean(
            (globalThis as { __bonescanViewer?: unknown }).__bonescanViewer,
          ),
        ),
      { timeout: 30_000 },
    )
    .toBe(true)
}

test('opens without an account, in exam order, with no way to change anything', async ({
  page,
}) => {
  await answerFor(page, true)
  await page.goto(`/s/${TOKEN}`)

  await expect(
    page.getByRole('heading', { level: 1, name: 'Shared reports' }),
  ).toBeVisible()
  const items = page.getByRole('listitem').filter({ hasText: /, 2026/ })
  await expect(items.nth(0)).toContainText('Sep 14, 2026')
  await expect(items.nth(1)).toContainText('Oct 12, 2026')
  await expect(items.nth(1)).toContainText('Unconfirmed')
  await waitForModel(page)
  expect((await markerInfo(page, 'shared-b2-finding-1')).bone).toBe(
    'radius_left',
  )

  // The viewer isn't the patient, so nothing on the page says "your". The
  // site's footer is the same for everyone.
  await expect(
    page.getByRole('button', { name: "The patient's left side", exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('main').getByText(/\byour\b/i)).toHaveCount(0)

  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  // Whole words, so the report's own "unchanged" doesn't count.
  for (const word of ['add', 'change', 'edit', 'delete', 'sign', 'account', 'share']) {
    const name = new RegExp(`\\b${word}\\b`, 'i')
    await expect(page.getByRole('button', { name })).toHaveCount(0)
    await expect(page.getByRole('link', { name })).toHaveCount(0)
  }
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, nofollow',
  )
})

test('shows the original PDF from the link, not from the owner’s files', async ({
  page,
}) => {
  await answerFor(page, true)
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.goto(`/s/${TOKEN}`)
  await page.getByRole('button', { name: 'Older', exact: true }).click()
  await page
    .getByRole('button', { name: 'Open with the original report' })
    .click()

  const pane = page.getByRole('region', { name: 'The original report' })
  await expect(pane.locator('[data-page="1"] canvas')).toBeVisible()
  expect(requests.some((url) => url.endsWith(FILE_URL))).toBe(true)
  expect(requests.some((url) => url.includes('/storage/'))).toBe(false)
})

test('a dead link says only that it is no longer available', async ({
  page,
}) => {
  await answerFor(page, false)
  await page.goto(`/s/${TOKEN}`)

  await expect(page.getByRole('main')).toHaveText(
    'This link is no longer available.',
  )
  await expect(page.getByRole('banner')).toHaveCount(0)
  await expect(page.getByRole('main').getByRole('link')).toHaveCount(0)
})
