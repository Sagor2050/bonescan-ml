import { expect, test, type Page } from '@playwright/test'
import { cameraState, markerInfo, openViewer, waitForCameraToStop } from './viewer.ts'

const reportButton = (page: Page, date: string) =>
  page.getByRole('button', { name: new RegExp(date) })

test.beforeEach(async ({ page }) => {
  await openViewer(page, '/reports')
})

test('lists B.1 first by exam date, though B.2 was added first', async ({
  page,
}) => {
  const items = page.getByRole('listitem').filter({ hasText: /, 2026/ })
  await expect(items).toHaveCount(2)
  await expect(items.nth(0)).toContainText('Sep 14, 2026')
  await expect(items.nth(1)).toContainText('Oct 12, 2026')
})

test('each report shows its date and the bones it involves', async ({
  page,
}) => {
  const first = reportButton(page, 'Sep 14, 2026')
  await expect(first).toContainText('left radius')
})

test('starts on the latest report, with its findings on the model', async ({
  page,
}) => {
  await expect(reportButton(page, 'Oct 12, 2026')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect((await markerInfo(page, 'sample-b2-finding-1')).bone).toBe(
    'radius_left',
  )
})

test('moving to an older or newer report changes the model', async ({ page }) => {
  await page.getByRole('button', { name: 'Older', exact: true }).click()
  await expect(reportButton(page, 'Sep 14, 2026')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect
    .poll(async () => (await markerInfo(page, 'sample-b1-finding-1')).bone)
    .toBe('radius_left')
  await expect(page.getByRole('button', { name: 'Older', exact: true })).toBeDisabled()

  await page.getByRole('button', { name: 'Newer', exact: true }).click()
  await expect
    .poll(async () => (await markerInfo(page, 'sample-b2-finding-1')).bone)
    .toBe('radius_left')
  await expect(page.getByRole('button', { name: 'Newer', exact: true })).toBeDisabled()
})

test('choosing a report from the list changes the model', async ({ page }) => {
  await reportButton(page, 'Sep 14, 2026').click()
  await expect
    .poll(async () => (await markerInfo(page, 'sample-b1-finding-1')).bone)
    .toBe('radius_left')
})

test('opens a report beside the original', async ({ page }) => {
  await page.getByRole('link', { name: 'Open with the original report' }).click()
  await expect(page).toHaveURL('/reports/sample-b2')
  await expect(
    page.getByRole('region', { name: 'Your original report' }),
  ).toBeVisible()
})

test('moving to another report keeps the angle the patient was looking from', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  // The camera eases into place, so wait until it has all but arrived.
  await expect
    .poll(async () => Math.abs((await cameraState(page)).azimuth))
    .toBeCloseTo(Math.PI, 1)
  await waitForCameraToStop(page)
  const before = await cameraState(page)

  await page.getByRole('button', { name: 'Older', exact: true }).click()
  await expect(reportButton(page, 'Sep 14, 2026')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect((await cameraState(page)).azimuth).toBeCloseTo(before.azimuth, 1)
})
