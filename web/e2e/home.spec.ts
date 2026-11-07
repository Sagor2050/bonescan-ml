import { expect, test, type Page } from '@playwright/test'

const canvas = (page: Page) => page.locator('figure canvas')

// Long enough for the model to load and draw.
async function modelReady(page: Page) {
  await expect(canvas(page)).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1500)
}

test('sign up and sign in are on the left, and the skeleton on the right', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')
  await modelReady(page)
  const create = await page
    .getByRole('main')
    .getByRole('link', { name: 'Create account' })
    .boundingBox()
  const signIn = await page
    .getByRole('main')
    .getByRole('link', { name: 'Sign in' })
    .boundingBox()
  const skeleton = await canvas(page).boundingBox()
  expect(create!.x + create!.width).toBeLessThan(skeleton!.x)
  expect(signIn!.x + signIn!.width).toBeLessThan(skeleton!.x)
  await expect(page.getByRole('figure')).toContainText(
    'This is a standard adult skeleton, not a model of your own bones.',
  )
})

test('the skeleton turns, and stops when asked', async ({ page }) => {
  await page.goto('/')
  await modelReady(page)

  const first = await canvas(page).screenshot()
  await page.waitForTimeout(1000)
  expect((await canvas(page).screenshot()).equals(first)).toBe(false)

  await page.getByRole('button', { name: 'Stop turning' }).click()
  await page.waitForTimeout(300)
  const stopped = await canvas(page).screenshot()
  await page.waitForTimeout(1000)
  expect((await canvas(page).screenshot()).equals(stopped)).toBe(true)
  await expect(page.getByRole('button', { name: 'Start turning' })).toBeVisible()
})

test('it stays still for people who ask for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await modelReady(page)
  await expect(page.getByRole('button', { name: 'Start turning' })).toBeVisible()
  const still = await canvas(page).screenshot()
  await page.waitForTimeout(1000)
  expect((await canvas(page).screenshot()).equals(still)).toBe(true)
})

test('the quick demo button does nothing yet', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /Quick demo/ })).toBeDisabled()
})

for (const path of ['/', '/sign-in', '/create-account', '/reports', '/add-report']) {
  test(`${path} has the footer`, async ({ page }) => {
    await page.goto(path)
    const footer = page.getByRole('contentinfo')
    await expect(footer).toContainText('not a medical device')
    await expect(footer).toContainText('Ask your care team')
  })
}

test('the footer does not take room from the model on a 13-inch laptop', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/reports')
  await expect(page.getByRole('region', { name: '3D skeleton' })).toBeVisible()
  const footer = await page.getByRole('contentinfo').boundingBox()
  expect(footer!.y).toBeGreaterThanOrEqual(720)
})
