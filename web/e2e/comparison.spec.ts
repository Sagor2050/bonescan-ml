import { expect, test, type Page } from '@playwright/test'
import {
  cameraState,
  markerInfo,
  openViewer,
  waitForCameraToStop,
} from './viewer.ts'

const model = (page: Page) => page.getByRole('region', { name: '3D skeleton' })
const list = (page: Page) => page.getByRole('region', { name: 'Comparison' })

async function startComparing(page: Page, path: string) {
  await openViewer(page, path)
  await page.getByRole('button', { name: 'Compare reports' }).click()
  await expect(list(page)).toBeVisible()
}

test.describe('the Appendix B reports', () => {
  test.beforeEach(async ({ page }) => {
    await startComparing(page, '/reports')
  })

  test('show the radius fracture in both, with healing words only on B.2', async ({
    page,
  }) => {
    const both = page.getByRole('group', { name: 'In both reports' })
    await expect(both.getByRole('button')).toHaveCount(1)
    await expect(both).toContainText('radius (forearm bone, thumb side)')

    const label = model(page).getByRole('button', { name: /In both reports/ })
    await expect(label).toHaveCount(1)
    await expect(label).toContainText(
      'Oct 12, 2026: Healing: “interval callus formation”, “healing”',
    )
    await expect(label).not.toContainText('Sep 14, 2026')
    await expect(
      page.getByRole('group', { name: 'Only in the earlier report' }),
    ).toHaveCount(0)
  })

  test('the history marks which report is earlier and later', async ({
    page,
  }) => {
    await expect(
      page.getByRole('button', { name: /Sep 14, 2026 \(Earlier\)/ }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByRole('button', { name: /Oct 12, 2026 \(Later\)/ }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('stopping returns to the one report', async ({ page }) => {
    await page.getByRole('button', { name: 'Stop comparing' }).click()
    await expect(list(page)).toHaveCount(0)
    await expect(
      model(page).getByRole('button', { name: /^Fracture/ }),
    ).toBeVisible()
  })
})

test.describe('three reports', () => {
  const path = '/reports?samples=comparison'

  test('any two can be chosen, in either order', async ({ page }) => {
    await startComparing(page, path)
    const first = page.getByLabel('First report')
    const second = page.getByLabel('Second report')
    await expect(first).toHaveValue('sample-c2')
    await expect(second).toHaveValue('sample-c3')

    await first.selectOption('sample-c1')
    await expect(
      page.getByRole('button', { name: /Jul 6, 2026 \(Earlier\)/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Oct 1, 2026 \(Later\)/ }),
    ).toBeVisible()

    // Swapping them changes nothing about which came first.
    await second.selectOption('sample-c2')
    await first.selectOption('sample-c3')
    await expect(
      page.getByRole('button', { name: /Aug 17, 2026 \(Earlier\)/ }),
    ).toBeVisible()
  })

  test('a report can’t be compared with itself', async ({ page }) => {
    await startComparing(page, path)
    await expect(
      page.getByLabel('First report').locator('option[value="sample-c3"]'),
    ).toHaveCount(0)
    await expect(
      page.getByLabel('Second report').locator('option[value="sample-c2"]'),
    ).toHaveCount(0)
  })

  test.describe('the first two', () => {
    test.beforeEach(async ({ page }) => {
      await startComparing(page, path)
      await page.getByLabel('Second report').selectOption('sample-c1')
    })

    test('mark each kind of finding by shape and label', async ({ page }) => {
      const label = (name: RegExp) =>
        model(page).getByRole('button', { name })
      await expect(label(/In both reports/)).toHaveCount(1)
      await expect(label(/Only in the earlier report/)).toHaveCount(2)
      await expect(label(/Only in the later report/)).toHaveCount(2)

      const both = await markerInfo(page, 'sample-c2-finding-1')
      const earlier = await markerInfo(page, 'sample-c1-finding-2')
      const later = await markerInfo(page, 'sample-c2-finding-2')
      expect(both.bone).toBe('radius_left')
      expect(earlier.bone).toBe('humerus_left')
      expect(later.bone).toBe('fibula_left')
      expect(new Set([both.shape, earlier.shape, later.shape]).size).toBe(3)
    })

    test('an uncertain finding keeps its shape and says it is possible', async ({
      page,
    }) => {
      const uncertain = await markerInfo(page, 'sample-c1-finding-3')
      const certain = await markerInfo(page, 'sample-c1-finding-2')
      expect(uncertain.shape).toBe(certain.shape)
      await expect(
        model(page).getByRole('button', { name: /tibia/ }),
      ).toContainText('Possible fracture')
    })

    test('choosing a row goes to its marker', async ({ page }) => {
      await page
        .getByRole('group', { name: 'Only in the later report' })
        .getByRole('button', { name: /fibula/ })
        .click()
      await expect(
        model(page).getByRole('button', { name: /fibula/ }),
      ).toHaveAttribute('aria-pressed', 'true')
    })

    test('a chosen label comes in front of the others', async ({ page }) => {
      const stacking = (name: RegExp) =>
        model(page)
          .getByRole('button', { name })
          .evaluate((label) => {
            let element = label.parentElement
            while (element && !element.style.zIndex) {
              element = element.parentElement
            }
            return Number(element?.style.zIndex ?? 0)
          })
      expect(await stacking(/radius/)).toBeLessThanOrEqual(10)

      await page
        .getByRole('group', { name: 'In both reports' })
        .getByRole('button', { name: /radius/ })
        .click()
      await expect.poll(() => stacking(/radius/)).toBeGreaterThan(10)
      expect(await stacking(/humerus/)).toBeLessThanOrEqual(10)
    })

    test('both reports share one view, so turning moves them together', async ({
      page,
    }) => {
      await expect(model(page).locator('canvas')).toHaveCount(1)

      const before = await markerInfo(page, 'sample-c1-finding-2')
      const laterBefore = await markerInfo(page, 'sample-c2-finding-2')
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await expect
        .poll(async () => (await markerInfo(page, 'sample-c1-finding-2')).ndcX)
        .toBeCloseTo(-before.ndcX, 1)
      await waitForCameraToStop(page)
      // The later report's marker mirrors with the earlier one's.
      expect((await markerInfo(page, 'sample-c2-finding-2')).ndcX).toBeCloseTo(
        -laterBefore.ndcX,
        1,
      )
    })
  })

  test('one bone at two spots keeps both markers, marked as in both', async ({
    page,
  }) => {
    await startComparing(page, path)
    await page.getByLabel('First report').selectOption('sample-c1')
    await expect(
      model(page).getByRole('button', { name: /In both reports/ }),
    ).toHaveCount(2)
  })

  test('a finding with no side is listed, with no marker', async ({ page }) => {
    await startComparing(page, path)
    await expect(list(page).getByText(/^Side not stated/)).toBeVisible()
  })
})

test('with one report, comparing is off and says why', async ({ page }) => {
  await openViewer(page, '/reports?samples=one')
  await expect(
    page.getByRole('button', { name: 'Compare reports' }),
  ).toBeDisabled()
  await expect(page.getByText('Add another report to compare.')).toBeVisible()
})

test('starting a comparison keeps the angle the patient was looking from', async ({
  page,
}) => {
  await openViewer(page, '/reports')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  // The camera eases into place, so wait until it has all but arrived.
  await expect
    .poll(async () => Math.abs((await cameraState(page)).azimuth))
    .toBeCloseTo(Math.PI, 1)
  await waitForCameraToStop(page)
  const before = await cameraState(page)

  await page.getByRole('button', { name: 'Compare reports' }).click()
  await expect(list(page)).toBeVisible()
  expect((await cameraState(page)).azimuth).toBeCloseTo(before.azimuth, 1)
})
