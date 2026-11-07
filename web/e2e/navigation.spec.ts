import { expect, test, type Page } from '@playwright/test'

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

for (const path of ['/', '/reports', '/reset-password']) {
  test(`a failed email link on ${path} says so on the sign-in screen`, async ({
    page,
  }) => {
    await page.goto(
      `${path}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=`,
    )
    await expect(page).toHaveURL('/sign-in?link=failed')
    await expect(page.getByRole('status')).toContainText(
      "That email link didn't work.",
    )
    await expect(
      page.getByRole('button', { name: 'Send a new confirmation link' }),
    ).toBeVisible()
  })
}

test.describe('on every page', () => {
  const pages = [
    '/',
    '/sign-in',
    '/create-account',
    '/reset-password',
    '/add-report',
    '/verify-findings',
    '/reports',
    '/reports/sample-b1',
    '/reports/sample-b1/change',
    '/account',
    '/no-such-page',
  ]

  for (const path of pages) {
    test(`${path} has the same footer, with the team and the app's name`, async ({
      page,
    }) => {
      await page.goto(path)
      const footer = page.getByRole('contentinfo')
      await expect(footer).toContainText('BoneScan3D')
      await expect(footer).toContainText('The White Coats')
      for (const name of ['Aliz', 'Jennifer', 'Justin', 'Sagor']) {
        await expect(footer.getByText(name, { exact: true })).toBeVisible()
      }
      await expect(
        footer.getByRole('link', { name: 'Source code' }),
      ).toBeVisible()
    })
  }
})

test.describe('the top bar', () => {
  async function looksLikeAButton(page: Page, name: string) {
    const item = page.getByRole('navigation').getByRole('link', { name })
    await expect(item).toHaveClass(/nav-button/)
    await expect(item).toBeVisible()
  }

  test('on the homepage, About and Sign in are buttons', async ({ page }) => {
    await page.goto('/')
    await looksLikeAButton(page, 'About')
    await looksLikeAButton(page, 'Sign in')
  })

  test('after signing in, My reports and Account are buttons', async ({
    page,
  }) => {
    await page.goto('/reports')
    await looksLikeAButton(page, 'My reports')
    await looksLikeAButton(page, 'Account')
    await expect(
      page.getByRole('navigation').getByRole('link', { name: 'My reports' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  test('the logo says BoneScan3D', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('banner')).toContainText('BoneScan3D')
    await page.goto('/reports')
    await expect(page.getByRole('banner')).toContainText('BoneScan3D')
  })
})
