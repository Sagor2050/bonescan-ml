import { expect, test, type Page } from '@playwright/test'
import { openFindingsTab, openViewer } from './viewer.ts'

const model = (page: Page) => page.getByRole('region', { name: '3D skeleton' })
const findings = (page: Page) => page.getByRole('region', { name: 'Findings' })

const B2_STATUS = 'Healing: “interval callus formation”, “healing”'

test('a report with healing words shows them on the marker and in the list', async ({
  page,
}) => {
  await openViewer(page, '/reports/sample-b2')
  await expect(model(page).getByText(B2_STATUS)).toBeVisible()
  await openFindingsTab(page)
  await expect(findings(page).getByText(B2_STATUS)).toBeVisible()
})

test('a report with no healing words shows no status', async ({ page }) => {
  await openViewer(page, '/reports/sample-b1')
  await expect(
    model(page).getByRole('button', { name: /Fracture/ }),
  ).toBeVisible()
  await expect(page.getByText(/^Healing:/)).toHaveCount(0)
  await expect(page.getByText(/^Report says: “/)).toHaveCount(0)
})

test('the status changes with the report shown on the timeline', async ({
  page,
}) => {
  await openViewer(page, '/reports')
  await expect(model(page).getByText(B2_STATUS)).toBeVisible()

  await page.getByRole('button', { name: 'Older' }).click()
  await expect(page.getByText(/^Healing:/)).toHaveCount(0)
})

test('only the finding with healing words shows a status', async ({ page }) => {
  await openViewer(page, '/reports/sample-mixed')
  await expect(model(page).getByText('Healed: “healed”')).toHaveCount(1)
  await expect(findings(page).getByText('Healed: “healed”')).toHaveCount(1)
  await expect(model(page).getByText(/^Healing:/)).toHaveCount(0)
})
