import { expect, test } from '@playwright/test'

test('shows the homepage', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Understand your imaging report in 3D' }),
  ).toBeVisible()
})
