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

  await page.getByLabel('Side for finding 1').selectOption('right')
  await expect(page.getByText('Entered by you')).toBeVisible()
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
