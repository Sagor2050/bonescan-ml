import { expect, test } from '@playwright/test'

test('goes from the homepage through every screen without reloading', async ({
  page,
}) => {
  let pageLoads = 0
  page.on('request', (request) => {
    if (request.isNavigationRequest()) pageLoads += 1
  })

  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Understand your imaging report in 3D' }),
  ).toBeVisible()

  const steps = [
    { link: 'Create account', path: '/create-account' },
    { link: 'Sign in', path: '/sign-in' },
    { link: 'Go to my reports', path: '/reports', heading: 'My reports' },
    { link: 'Add a report', path: '/add-report' },
    { link: 'Check the findings', path: '/verify-findings' },
    {
      link: 'See it on the skeleton',
      path: '/reports/sample-b1',
      heading: 'Your report and skeleton',
    },
    { link: 'Account', path: '/account' },
    { link: 'My reports', path: '/reports' },
  ]

  for (const step of steps) {
    await page.getByRole('link', { name: step.link }).first().click()
    await expect(page).toHaveURL(step.path)
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: step.heading ?? step.link,
      }),
    ).toBeVisible()
  }

  expect(pageLoads).toBe(1)
})

test('the back and forward buttons move between screens', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Create account' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Create account' }),
  ).toBeVisible()

  await page.goBack()
  await expect(page).toHaveURL('/')
  await expect(
    page.getByRole('heading', { name: 'Understand your imaging report in 3D' }),
  ).toBeVisible()

  await page.goForward()
  await expect(page).toHaveURL('/create-account')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Create account' }),
  ).toBeVisible()
})

for (const [path, heading] of [
  ['/sign-in', 'Sign in'],
  ['/create-account', 'Create account'],
  ['/add-report', 'Add a report'],
  ['/verify-findings', 'Check the findings'],
  ['/reports/sample-b1', 'Your report and skeleton'],
  ['/reports', 'My reports'],
  ['/account', 'Account'],
]) {
  test(`a direct link to ${path} opens its screen`, async ({ page }) => {
    await page.goto(path)
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible()
  })
}

test('a link to a screen that does not exist says so', async ({ page }) => {
  await page.goto('/no-such-screen')
  await expect(
    page.getByRole('heading', { name: "We can't find that page" }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Go to the homepage' }).click()
  await expect(page).toHaveURL('/')
})
