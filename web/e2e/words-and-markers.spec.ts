import { expect, test, type Page } from '@playwright/test'
import { markerInfo, openViewer, waitForCameraToStop } from './viewer.ts'

const reportPane = (page: Page) =>
  page.getByRole('region', { name: 'Your original report' })
const findings = (page: Page) => page.getByRole('region', { name: 'Findings' })

async function expectCentered(page: Page, findingId: string) {
  await waitForCameraToStop(page)
  const marker = await markerInfo(page, findingId)
  expect(Math.abs(marker.ndcX)).toBeLessThan(0.03)
  expect(Math.abs(marker.ndcY)).toBeLessThan(0.03)
}

test.describe('the B.1 PDF', () => {
  const findingId = 'sample-b1-finding-1'

  test.beforeEach(async ({ page }) => {
    await openViewer(page, '/reports/sample-b1')
    await expect(reportPane(page).locator('[data-page="1"]')).toHaveAttribute(
      'data-drawn',
      'true',
    )
  })

  test('marks the wording from both Findings and Impression', async ({
    page,
  }) => {
    await expect(
      reportPane(page).getByRole('button', {
        name: /Show on the model: There is a transverse/,
      }),
    ).toHaveCount(2)
    await expect(
      reportPane(page).getByRole('button', {
        name: /Show on the model: Mildly angulated/,
      }),
    ).toHaveCount(1)
  })

  test('a highlight sits where the fixture says, at this zoom', async ({
    page,
  }) => {
    const pdfPage = await reportPane(page)
      .locator('[data-page="1"] canvas')
      .boundingBox()
    const highlight = await reportPane(page)
      .getByRole('button', { name: /Mildly angulated/ })
      .boundingBox()
    if (!pdfPage || !highlight) throw new Error('Missing a box')
    const scale = pdfPage.width / 612
    expect(highlight.x - pdfPage.x).toBeCloseTo(147.19 * scale, 0)
    expect(highlight.y - pdfPage.y).toBeCloseTo(189.28 * scale, 0)
    expect(highlight.width).toBeCloseTo((349.54 - 147.19) * scale, 0)
  })

  test('clicking the wording centers its marker, and clicking the marker shows the wording', async ({
    page,
  }) => {
    const wording = reportPane(page).getByRole('button', {
      name: /Mildly angulated/,
    })
    await wording.click()
    await expect(wording).toHaveAttribute('aria-pressed', 'true')
    await expectCentered(page, findingId)
    await expect(findings(page).getByRole('button', { pressed: true })).toHaveCount(1)

    await page.getByRole('button', { name: 'Starting view' }).click()
    await waitForCameraToStop(page)
    await findings(page).getByRole('button', { name: /radius/ }).click()
    await waitForCameraToStop(page)
    const marker = await markerInfo(page, findingId)
    await page.mouse.click(marker.screenX, marker.screenY)
    await expect(wording).toBeInViewport()
  })
})

test('choosing a finding scrolls the report to its wording on a later page', async ({
  page,
}) => {
  await openViewer(page, '/reports/sample-two-pages')
  const wording = reportPane(page).getByRole('button', {
    name: /Sample page two/,
  })
  await expect(wording).toHaveCount(1)
  await expect(wording).not.toBeInViewport()

  await findings(page).getByRole('button', { name: /radius/ }).click()

  await expect(wording).toBeInViewport()
})

test('clicking pasted wording centers its marker', async ({ page }) => {
  await openViewer(page, '/reports/sample-b1-pasted')
  const wording = reportPane(page).getByRole('button', {
    name: /Mildly angulated/,
  })
  await wording.click()
  await expect(wording).toHaveAttribute('aria-pressed', 'true')
  await expectCentered(page, 'sample-b1-pasted-finding-1')
})
