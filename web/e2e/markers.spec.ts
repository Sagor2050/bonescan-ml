import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import {
  boneOnScreen,
  markerInfo,
  openViewer,
  waitForCameraToStop,
} from './viewer.ts'

const bones = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../public/shared/bones.json'),
    'utf8',
  ),
) as { id: string; parts: Record<string, number[]> }[]

// The labels on the model, leaving out the findings list beside it.
const model = (page: Page) => page.getByRole('region', { name: '3D skeleton' })

// Finds the marker's red in a real screenshot of the model and returns where it
// is across the view, from -1 to 1. This catches a mirrored model from end to
// end, because it trusts the pixels and not the scene (Plan Milestone 3).
async function redPixelsAcrossView(page: Page) {
  const canvas = page.locator('canvas')
  const png = (await canvas.screenshot()).toString('base64')
  return page.evaluate(`(async () => {
    const image = new Image()
    image.src = 'data:image/png;base64,${png}'
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const { data } = context.getImageData(0, 0, image.width, image.height)
    let total = 0
    let count = 0
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const at = (y * image.width + x) * 4
        if (data[at] > 200 && data[at + 1] < 90 && data[at + 2] < 90) {
          total += x
          count += 1
        }
      }
    }
    return count ? { count, x: (total / count / image.width) * 2 - 1 } : { count, x: 0 }
  })()`) as Promise<{ count: number; x: number }>
}

test('B.1’s fracture is one marker on the left radius, on the viewer’s right', async ({
  page,
}) => {
  await openViewer(page, '/reports/sample-b1')

  const marker = await markerInfo(page, 'sample-b1-finding-1')
  expect(marker.bone).toBe('radius_left')
  const distal = bones.find((bone) => bone.id === 'radius_left')?.parts.distal
  marker.world.forEach((value, axis) => {
    expect(value).toBeCloseTo(distal?.[axis] ?? NaN, 3)
  })
  expect(marker.ndcX).toBeGreaterThan(0)

  await expect(
    model(page).getByRole('button', { name: /radius \(forearm bone, thumb side\)/ }),
  ).toHaveCount(1)

  const red = await redPixelsAcrossView(page)
  expect(red.count).toBeGreaterThan(20)
  expect(red.x).toBeGreaterThan(0.05)
})

test('from the back, the same marker is on the viewer’s left', async ({
  page,
}) => {
  await openViewer(page, '/reports/sample-b1')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await waitForCameraToStop(page)

  const red = await redPixelsAcrossView(page)
  expect(red.count).toBeGreaterThan(20)
  expect(red.x).toBeLessThan(-0.05)
})

test('the marker stays on its point when the view changes', async ({ page }) => {
  await openViewer(page, '/reports/sample-b1')
  const before = await markerInfo(page, 'sample-b1-finding-1')

  await page.getByRole('button', { name: 'Your left side', exact: true }).click()
  await waitForCameraToStop(page)
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await waitForCameraToStop(page)

  const after = await markerInfo(page, 'sample-b1-finding-1')
  after.world.forEach((value, axis) => {
    expect(value).toBeCloseTo(before.world[axis], 6)
  })
})

test('one finding on each of the 126 bones lands on each bone', async ({
  page,
}) => {
  await openViewer(page, '/reports/sample-all-bones')

  for (const [index, bone] of bones.entries()) {
    const marker = await markerInfo(
      page,
      `sample-all-bones-finding-${index + 1}`,
    )
    expect(marker.bone).toBe(bone.id)
    expect(Math.sign(marker.world[0])).toBe(bone.id.endsWith('_left') ? 1 : -1)
  }
  await expect(model(page).getByRole('button', { name: /Fracture/ })).toHaveCount(126)
})

test.describe('a report with several kinds of finding', () => {
  const finding = (index: number) => `sample-mixed-finding-${index}`

  test.beforeEach(async ({ page }) => {
    await openViewer(page, '/reports/sample-mixed')
  })

  test('certain and uncertain findings have different shapes and labels', async ({
    page,
  }) => {
    const certain = await markerInfo(page, finding(1))
    const uncertain = await markerInfo(page, finding(2))
    expect(certain.shape).not.toBe(uncertain.shape)
    await expect(
      model(page).getByRole('button', { name: /Possible fracture.*tibia/ }),
    ).toHaveCount(1)
    await expect(model(page).getByRole('button', { name: /^.?\s*Fracture/ })).toHaveCount(3)
  })

  test('a finding with no named part sits in the middle of its bone', async ({
    page,
  }) => {
    const marker = await markerInfo(page, finding(3))
    expect(marker.bone).toBe('humerus_left')
    const humerus = await boneOnScreen(page, 'humerus_left')
    expect(Math.abs(marker.screenY - humerus.y)).toBeLessThan(40)
  })

  test('a finding the patient entered says so on its marker', async ({ page }) => {
    await expect(
      model(page).getByRole('button', { name: /fibula.*Entered by you/ }),
    ).toHaveCount(1)
  })

  test('a finding with no side gets no marker', async ({ page }) => {
    await expect(model(page).getByRole('button', { name: /radius/ })).toHaveCount(0)
    await expect(
      model(page).getByRole('button', { name: /Fracture|fracture/ }),
    ).toHaveCount(4)
  })

  test('a whole-bone marker keeps its own look on the highlighted bone', async ({
    page,
  }) => {
    const red = await redPixelsAcrossView(page)
    expect(red.count).toBeGreaterThan(60)
  })

  test('clicking a label selects its finding, not the bone behind it', async ({
    page,
  }) => {
    await model(page).getByRole('button', { name: /tibia/ }).click()
    await expect(page.getByText('Click a bone to see its name.')).toBeVisible()
  })

  test('clicking a marker or its label selects its finding', async ({ page }) => {
    const label = model(page).getByRole('button', { name: /femur/ })
    await expect(label).toHaveAttribute('aria-pressed', 'false')
    await label.click()
    await expect(label).toHaveAttribute('aria-pressed', 'true')

    const tibia = await markerInfo(page, finding(2))
    await page.mouse.click(tibia.screenX, tibia.screenY)
    await expect(
      model(page).getByRole('button', { name: /tibia/ }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(label).toHaveAttribute('aria-pressed', 'false')
  })
})
