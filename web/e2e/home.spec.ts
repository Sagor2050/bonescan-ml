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

// How far the model reaches into the box over part of a turn, from its pixels, as
// shares of the box. The canvas is see-through, so only the bones have any alpha.
function modelExtent(page: Page) {
  return page.evaluate(`(async () => {
    const canvas = document.querySelector('figure canvas')
    let top = 1
    let bottom = 0
    let left = 1
    let right = 0
    for (let frame = 0; frame < 8; frame += 1) {
      await new Promise((done) => {
        requestAnimationFrame(() => {
          const copy = document.createElement('canvas')
          copy.width = canvas.width
          copy.height = canvas.height
          const context = copy.getContext('2d')
          context.drawImage(canvas, 0, 0)
          const { data } = context.getImageData(0, 0, copy.width, copy.height)
          for (let y = 0; y < copy.height; y += 2) {
            for (let x = 0; x < copy.width; x += 2) {
              if (data[(y * copy.width + x) * 4 + 3] > 200) {
                top = Math.min(top, y / copy.height)
                bottom = Math.max(bottom, y / copy.height)
                left = Math.min(left, x / copy.width)
                right = Math.max(right, x / copy.width)
              }
            }
          }
          done()
        })
      })
      await new Promise((done) => setTimeout(done, 800))
    }
    return { top, bottom, left, right }
  })()`) as Promise<{ top: number; bottom: number; left: number; right: number }>
}

for (const [width, height] of [
  [1280, 720],
  [1920, 1080],
  [1000, 700],
]) {
  test(`the whole skeleton fits in its box with room around it at ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await modelReady(page)
    const { top, bottom, left, right } = await modelExtent(page)
    // It found the model, which fills a good part of the box's height.
    expect(bottom - top).toBeGreaterThan(0.5)
    // Below the notice, above the bottom edge, and clear of both sides.
    expect(top).toBeGreaterThan(0.12)
    expect(bottom).toBeLessThan(0.88)
    expect(left).toBeGreaterThan(0.1)
    expect(right).toBeLessThan(0.9)
  })
}

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
