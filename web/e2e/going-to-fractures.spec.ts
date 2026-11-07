import { expect, test, type Page } from '@playwright/test'
import {
  boneIsVisible,
  cameraState,
  markerInfo,
  openFindingsTab,
  openViewer,
  waitForCameraToStop,
} from './viewer.ts'

const findings = (page: Page) => page.getByRole('region', { name: 'Findings' })
const model = (page: Page) => page.getByRole('region', { name: '3D skeleton' })

async function expectCentered(page: Page, findingId: string) {
  await waitForCameraToStop(page)
  const marker = await markerInfo(page, findingId)
  expect(Math.abs(marker.ndcX)).toBeLessThan(0.03)
  expect(Math.abs(marker.ndcY)).toBeLessThan(0.03)
}

test.describe('a report with several findings', () => {
  test.beforeEach(async ({ page }) => {
    await openViewer(page, '/reports/sample-mixed')
  })

  test('lists the findings while the model is in view', async ({ page }) => {
    await expect(findings(page).getByRole('listitem')).toHaveCount(5)
    await expect(model(page).locator('canvas')).toBeVisible()
    await expect(findings(page)).toContainText('Side not stated')
    await expect(findings(page)).toContainText('Ask your care team')
  })

  test('choosing a finding centers its fracture and zooms in', async ({
    page,
  }) => {
    const start = (await cameraState(page)).distance
    await findings(page).getByRole('button', { name: /tibia/ }).click()
    await expectCentered(page, 'sample-mixed-finding-2')
    expect((await cameraState(page)).distance).toBeLessThan(start)
  })

  test('choosing the same finding again brings the camera back', async ({
    page,
  }) => {
    const tibia = findings(page).getByRole('button', { name: /tibia/ })
    await tibia.click()
    await expectCentered(page, 'sample-mixed-finding-2')

    await page.getByRole('button', { name: 'Starting view' }).click()
    await waitForCameraToStop(page)
    await tibia.click()
    await expectCentered(page, 'sample-mixed-finding-2')
  })

  test('steps through the findings', async ({ page }) => {
    const next = findings(page).getByRole('button', { name: 'Next' })
    await next.click()
    await expectCentered(page, 'sample-mixed-finding-1')
    await next.click()
    await expectCentered(page, 'sample-mixed-finding-2')
    await findings(page).getByRole('button', { name: 'Previous' }).click()
    await expectCentered(page, 'sample-mixed-finding-1')
  })

  test('a finding with no marker can be chosen and leaves the camera alone', async ({
    page,
  }) => {
    const before = await cameraState(page)
    const finding = findings(page).getByRole('button', {
      name: /Side not stated/,
    })
    await finding.click()
    await expect(finding).toHaveAttribute('aria-pressed', 'true')
    await page.waitForTimeout(500)
    expect((await cameraState(page)).distance).toBeCloseTo(before.distance, 3)
  })

  test('shows an injured bone on its own and brings back the skeleton', async ({
    page,
  }) => {
    // It's only offered once there's a bone to show.
    const alone = page.getByRole('button', { name: 'Show this bone on its own' })
    await expect(alone).toHaveCount(0)

    await findings(page).getByRole('button', { name: /femur/ }).click()
    await alone.click()
    await waitForCameraToStop(page)

    expect(await boneIsVisible(page, 'femur_right')).toBe(true)
    expect(await boneIsVisible(page, 'femur_left')).toBe(false)
    expect(await boneIsVisible(page, 'tibia_left')).toBe(false)
    await expect(model(page).getByRole('button', { name: /tibia/ })).toHaveCount(0)
    await expect(model(page).getByRole('button', { name: /femur/ })).toHaveCount(1)

    await page.getByRole('button', { name: 'Show the full skeleton' }).click()
    expect(await boneIsVisible(page, 'femur_left')).toBe(true)
    await expect(model(page).getByRole('button', { name: /tibia/ })).toHaveCount(1)
  })

  test('choosing a finding on another bone brings the skeleton back', async ({
    page,
  }) => {
    await findings(page).getByRole('button', { name: /femur/ }).click()
    await page.getByRole('button', { name: 'Show this bone on its own' }).click()
    await findings(page).getByRole('button', { name: /tibia/ }).click()
    await expectCentered(page, 'sample-mixed-finding-2')
    expect(await boneIsVisible(page, 'tibia_left')).toBe(true)
  })
})

test('a fracture on a small bone is brought close', async ({ page }) => {
  await openViewer(page, '/reports/sample-all-bones')
  await openFindingsTab(page)
  const list = findings(page).getByRole('listitem')
  const index = await list.evaluateAll((items) =>
    items.findIndex((item) => /little finger|fifth finger/.test(item.textContent)),
  )
  expect(index).toBeGreaterThan(-1)
  await list.nth(index).getByRole('button').click()
  await waitForCameraToStop(page)
  expect((await cameraState(page)).distance).toBeLessThan(0.4)
})
