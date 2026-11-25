import { expect, test } from '@playwright/test'

// S10.1 with the fictional sample reports, which development shares in memory.
test('shares chosen reports by link, then turns the link off', async ({ page }) => {
  await page.goto('/reports')
  await page.getByRole('link', { name: 'Share reports' }).click()
  await expect(page).toHaveURL('/share')

  const make = page.getByRole('button', { name: 'Make the link' })
  await expect(
    page.getByText(
      'Anyone who has this link can view these reports until it expires or you turn it off.',
    ),
  ).toBeVisible()
  await expect(page.getByLabel('Link stops working after')).toHaveValue('30')

  await page.getByLabel(/Sep 14, 2026/).check()
  await expect(make).toBeDisabled()
  await page.getByLabel('Link stops working after').selectOption('never')
  await expect(page.getByText('This link never expires.')).toBeVisible()
  await page.getByLabel('I understand').check()
  await make.click()

  await expect(page.getByRole('heading', { name: 'Your link is ready' })).toBeVisible()
  await expect(page.getByLabel('Share link')).toHaveValue(/\/s\/[A-Za-z0-9_-]{43}$/)
  await expect(page.getByText(/can't show this link again/)).toBeVisible()

  await page.getByRole('link', { name: 'Shared links' }).click()
  await expect(page).toHaveURL('/account/shared-links')
  const row = page.getByRole('list', { name: 'Your shared links' }).getByRole('listitem')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Sep 14, 2026')
  await expect(row).toContainText('Never')
  await expect(row).toContainText('Active')
  await expect(page.getByText(/\/s\//)).toHaveCount(0)

  await row.getByRole('button', { name: 'Turn off' }).click()
  await row.getByRole('button', { name: 'Yes, turn it off' }).click()
  await expect(row).toContainText('Turned off')
  await expect(row.getByRole('button')).toHaveCount(0)
})
