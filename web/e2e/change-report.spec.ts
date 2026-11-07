import { expect, test, type Page } from '@playwright/test'
import { markerInfo, openViewer } from './viewer.ts'

const reportButton = (page: Page, date: string) =>
  page.getByRole('button', { name: new RegExp(date) })

async function openChange(page: Page, path = '/reports/sample-b1') {
  await openViewer(page, path)
  await page.getByRole('link', { name: 'Change the date or findings' }).click()
  await expect(
    page.getByRole('heading', { name: 'Change the date or findings' }),
  ).toBeVisible()
}

const save = (page: Page) =>
  page.getByRole('button', { name: 'Save my changes' }).click()

test('a new exam date moves the report in the timeline', async ({ page }) => {
  await openViewer(page, '/reports')
  const items = page.getByRole('listitem').filter({ hasText: /, 2026/ })
  await expect(items.nth(0)).toContainText('Sep 14, 2026')

  await reportButton(page, 'Sep 14, 2026').click()
  await page
    .getByRole('link', { name: 'Open with the original report' })
    .click()
  await page.getByRole('link', { name: 'Change the date or findings' }).click()
  await page.getByLabel('Exam date').fill('2026-10-20')
  await save(page)

  await expect(page.getByText('Exam date: Oct 20, 2026')).toBeVisible()
  await page.getByRole('link', { name: '← My reports' }).click()
  await expect(items.nth(0)).toContainText('Oct 12, 2026')
  await expect(items.nth(1)).toContainText('Oct 20, 2026')
})

test('a future date can’t be saved', async ({ page }) => {
  await openChange(page)
  await page.getByLabel('Exam date').fill('2999-01-01')
  await expect(page.getByRole('alert')).toContainText("can't be in the future")
  await expect(
    page.getByRole('button', { name: 'Save my changes' }),
  ).toBeDisabled()
})

test('changing a side moves the marker and labels it as the patient’s', async ({
  page,
}) => {
  await openChange(page)
  await page.getByLabel('Side for finding 1').selectOption('right')
  await save(page)

  await expect(
    page.getByRole('region', { name: '3D skeleton' }).getByText('Entered by you'),
  ).toBeVisible()
  expect((await markerInfo(page, 'sample-b1-finding-1')).bone).toBe(
    'radius_right',
  )
  await expect(
    page.getByRole('region', { name: 'Findings' }).getByText('Entered by you'),
  ).toBeVisible()
})

test('the original report’s words are still there after a correction', async ({
  page,
}) => {
  await openChange(page, '/reports/sample-b1-pasted')
  const original = 'Mildly angulated distal left radius fracture.'
  await page.getByLabel('Side for finding 1').selectOption('right')
  await save(page)
  await expect(
    page.getByRole('region', { name: 'Your original report' }),
  ).toContainText(original)
})

test('removing a finding removes its marker', async ({ page }) => {
  await openChange(page)
  await page.getByRole('button', { name: 'Remove finding 1' }).click()
  await expect(page.getByText(/has no findings listed/)).toBeVisible()
  await save(page)

  await expect(
    page.getByRole('region', { name: 'Findings' }),
  ).toContainText('This report has no findings to show.')
  await expect(
    page.getByRole('region', { name: '3D skeleton' }).getByRole('button', {
      name: /radius/,
    }),
  ).toHaveCount(0)
})

test('adding a missed finding puts it on the skeleton', async ({ page }) => {
  await openChange(page)
  await page.getByRole('button', { name: 'Add a finding we missed' }).click()
  await page.getByLabel('Bone for finding 2').selectOption('femur')
  await page.getByLabel('Side for finding 2').selectOption('left')
  await save(page)

  const model = page.getByRole('region', { name: '3D skeleton' })
  await expect(model.getByRole('button', { name: /femur/ })).toContainText(
    'Entered by you',
  )
})

test('cancelling leaves the report as it was', async ({ page }) => {
  await openChange(page)
  await page.getByLabel('Exam date').fill('2026-10-20')
  await page.getByRole('link', { name: 'Cancel' }).click()
  await expect(page.getByText('Exam date: Sep 14, 2026')).toBeVisible()
})
