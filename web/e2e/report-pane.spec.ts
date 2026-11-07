import { expect, test, type Page } from '@playwright/test'
import { openFindingsTab, openReportTab, openViewer } from './viewer.ts'

const reportPane = (page: Page) =>
  page.getByRole('region', { name: 'Your original report' })
const model = (page: Page) => page.getByRole('region', { name: '3D skeleton' })

async function hasInk(page: Page, pageNumber: number) {
  return reportPane(page)
    .locator(`[data-page="${pageNumber}"] canvas`)
    .evaluate((canvas) => {
      // These names come from the browser, which the test's types don't know.
      const element = canvas as unknown as {
        width: number
        height: number
        getContext: (kind: string) => {
          getImageData: (
            ...area: number[]
          ) => { data: Uint8ClampedArray }
        }
      }
      const { data } = element
        .getContext('2d')
        .getImageData(0, 0, element.width, element.height)
      for (let at = 0; at < data.length; at += 4) {
        if (data[at + 3] > 0 && data[at] < 128) return true
      }
      return false
    })
}

test('shows the original PDF and the model at the same time', async ({
  page,
}) => {
  await openViewer(page, '/reports/sample-b1')
  const pdfPage = reportPane(page).locator('[data-page="1"]')
  await expect(pdfPage).toHaveAttribute('data-drawn', 'true')
  expect(await hasInk(page, 1)).toBe(true)
  await expect(pdfPage).toBeInViewport()
  await expect(model(page).locator('canvas')).toBeInViewport()
})

test('shows pasted text as written and the model at the same time', async ({
  page,
}) => {
  await openViewer(page, '/reports/sample-b1-pasted')
  await expect(reportPane(page).locator('pre')).toContainText(
    'EXAM: XR WRIST LEFT, 3 VIEWS',
  )
  await expect(model(page).locator('canvas')).toBeInViewport()
})

test('every page can be read while the model stays in view', async ({
  page,
}) => {
  await openViewer(page, '/reports/sample-two-pages')
  const second = reportPane(page).locator('[data-page="2"]')
  await expect(second).toHaveAttribute('data-drawn', 'true')
  expect(await hasInk(page, 2)).toBe(true)

  await second.scrollIntoViewIfNeeded()

  await expect(second).toBeInViewport()
  await expect(model(page).locator('canvas')).toBeInViewport()
})

test('the model can be viewed on its own and the report brought back', async ({
  page,
}) => {
  await openViewer(page, '/reports/sample-b1')
  const canvas = model(page).locator('canvas')
  const pdfPage = reportPane(page).locator('[data-page="1"]')
  await expect(pdfPage).toHaveAttribute('data-drawn', 'true')
  const widthBefore = (await canvas.boundingBox())?.width ?? 0

  await openFindingsTab(page)
  await expect(reportPane(page)).toBeHidden()
  await expect
    .poll(async () => (await canvas.boundingBox())?.width ?? 0)
    .toBeGreaterThan(widthBefore)

  await openReportTab(page)
  await expect(pdfPage).toBeInViewport()
  await expect(canvas).toBeInViewport()
})

test('a marker’s label fits inside the narrower model pane', async ({ page }) => {
  await openViewer(page, '/reports/sample-b1')
  const canvas = await model(page).locator('canvas').boundingBox()
  const label = model(page).getByRole('button', { name: /radius/ })
  await expect
    .poll(async () => {
      const box = await label.boundingBox()
      return (
        box !== null &&
        canvas !== null &&
        box.x >= canvas.x &&
        box.x + box.width <= canvas.x + canvas.width
      )
    })
    .toBe(true)
})

test('the findings come first when one has no marker, so the reason is not hidden', async ({
  page,
}) => {
  await openViewer(page, '/reports/sample-mixed')
  await expect(page.getByRole('tab', { name: /^Findings/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByText(/^Side not stated/)).toBeVisible()
})

test('the report and the findings both point back to the care team', async ({
  page,
}) => {
  await openViewer(page, '/reports/sample-b1')
  await expect(reportPane(page)).toContainText('Ask your care team')
  await openFindingsTab(page)
  await expect(
    page.getByRole('region', { name: 'Findings' }),
  ).toContainText('Ask your care team')
})

test('the arrow keys move between the report and the findings', async ({
  page,
}) => {
  await openViewer(page, '/reports/sample-b1')
  await page.getByRole('tab', { name: 'Your original report' }).focus()
  await page.keyboard.press('ArrowRight')
  const findingsTab = page.getByRole('tab', { name: /^Findings/ })
  await expect(findingsTab).toBeFocused()
  await expect(findingsTab).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowLeft')
  await expect(reportPane(page)).toBeVisible()
})

test('a report that does not exist says so', async ({ page }) => {
  await page.goto('/reports/no-such-report')
  await expect(page.getByText("We can't find that report.")).toBeVisible()
})
