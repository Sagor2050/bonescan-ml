import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const B1_PDF = '../tests/fixtures/report-b1.pdf'
const B1_RESPONSE = readFileSync('../tests/fixtures/read-b1-pdf.json', 'utf8')

// The reader runs as a separate service, so these tests answer for it.
const CORS = { 'Access-Control-Allow-Origin': '*' }

test('a PDF goes from adding to checking, and nothing is saved', async ({
  page,
}) => {
  await page.route('**/read', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: B1_RESPONSE,
    }),
  )
  await page.goto('/add-report')
  await page.getByLabel(/PDF file/).setInputFiles(B1_PDF)
  await page.getByRole('button', { name: 'Read my report' }).click()

  await expect(page).toHaveURL('/verify-findings')
  await expect(
    page.getByRole('heading', { name: 'Check the findings' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', {
      name: 'radius (forearm bone, thumb side), left side',
    }),
  ).toBeVisible()
  await expect(
    page.getByText('Mildly angulated distal left radius fracture.'),
  ).toBeVisible()
  await expect(page.getByLabel('Exam date')).toHaveValue('2026-09-14')

  await page.getByRole('button', { name: 'Change finding 1' }).click()
  await page.getByLabel('Side for finding 1').selectOption('right')
  await expect(page.getByText('Entered by you')).toBeVisible()
})

test('the steps say where the patient is, and nothing is saved until they confirm', async ({
  page,
}) => {
  await page.route('**/read', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: B1_RESPONSE,
    }),
  )
  await page.goto('/add-report')
  const steps = page.getByRole('list', { name: 'Steps to add a report' })
  await expect(steps.locator('[aria-current="step"]')).toContainText(
    'Add your report',
  )
  // The report is already being added, so the top bar doesn't offer it again.
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', {
      name: 'Add a report',
    }),
  ).toHaveCount(0)

  await page.getByLabel(/PDF file/).setInputFiles(B1_PDF)
  await expect(page.getByText('report-b1.pdf')).toBeVisible()
  await page.getByRole('button', { name: 'Read my report' }).click()

  await expect(steps.locator('[aria-current="step"]')).toContainText(
    'Check the findings',
  )
  await expect(page.getByText('Nothing is saved until you confirm.')).toBeVisible()
})

test('clicking the words chooses between a PDF and pasted text', async ({ page }) => {
  await page.goto('/add-report')
  await page.getByText('Paste the text').click()
  await expect(page.getByLabel('Report text')).toBeVisible()
  await expect(page.getByLabel(/PDF file/)).toHaveCount(0)
  await page.getByRole('radio', { name: 'Upload a PDF' }).check()
  await expect(page.getByLabel(/PDF file/)).toBeAttached()
})

test('the confirm button stays in view while reading a long list', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/reports/sample-mixed/change')
  await expect(
    page.getByRole('button', { name: 'Save my changes' }),
  ).toBeInViewport()
})

test('a refused file shows why and stays on the screen', async ({ page }) => {
  await page.route('**/read', (route) =>
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify({
        refusal: 'not_pdf',
        message: "This file isn't a PDF we can open, so it wasn't added.",
      }),
    }),
  )
  await page.goto('/add-report')
  await page.getByLabel(/PDF file/).setInputFiles(B1_PDF)
  await page.getByRole('button', { name: 'Read my report' }).click()

  await expect(page.getByRole('alert')).toContainText("isn't a PDF")
  await expect(page).toHaveURL('/add-report')
})
