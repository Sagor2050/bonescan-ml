import { expect, test } from '@playwright/test'

test('loads the app in the browser', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'BoneScan' })).toBeVisible()
})
