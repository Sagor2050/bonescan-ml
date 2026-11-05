import { expect, test } from '@playwright/test'
import {
  boneOnScreen,
  cameraState,
  openViewer,
  waitForCameraToStop,
} from './viewer.ts'

test('says it is a standard skeleton, not the patient’s own bones', async ({
  page,
}) => {
  await openViewer(page)
  await expect(
    page.getByText(
      'This is a standard adult skeleton, not a model of your own bones.',
    ),
  ).toBeVisible()
})

test('starts from the front, with the patient’s left on the viewer’s right', async ({
  page,
}) => {
  await openViewer(page)
  expect((await boneOnScreen(page, 'radius_left')).ndcX).toBeGreaterThan(0)
  expect((await boneOnScreen(page, 'radius_right')).ndcX).toBeLessThan(0)
})

test('goes straight to the back, left-side, and right-side views', async ({
  page,
}) => {
  await openViewer(page)

  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await waitForCameraToStop(page)
  expect((await cameraState(page)).z).toBeLessThan(-2)
  expect((await boneOnScreen(page, 'radius_left')).ndcX).toBeLessThan(0)

  await page.getByRole('button', { name: 'Your left side', exact: true }).click()
  await waitForCameraToStop(page)
  expect((await cameraState(page)).x).toBeGreaterThan(2)

  await page.getByRole('button', { name: 'Your right side', exact: true }).click()
  await waitForCameraToStop(page)
  expect((await cameraState(page)).x).toBeLessThan(-2)

  await page.getByRole('button', { name: 'Front', exact: true }).click()
  await waitForCameraToStop(page)
  expect((await cameraState(page)).z).toBeGreaterThan(2)
  expect((await boneOnScreen(page, 'radius_left')).ndcX).toBeGreaterThan(0)
})

test('dragging turns the model, and the starting view returns', async ({
  page,
}) => {
  await openViewer(page)
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('No canvas')
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

  await page.mouse.move(middle.x, middle.y)
  await page.mouse.down()
  await page.mouse.move(middle.x + 150, middle.y + 40, { steps: 5 })
  await page.mouse.up()
  await waitForCameraToStop(page)
  expect(Math.abs((await cameraState(page)).azimuth)).toBeGreaterThan(0.3)

  await page.getByRole('button', { name: 'Starting view' }).click()
  await waitForCameraToStop(page)
  const camera = await cameraState(page)
  expect(camera.x).toBeCloseTo(0, 1)
  expect(camera.distance).toBeCloseTo(3, 1)
})

test('the zoom buttons move the camera in and out', async ({ page }) => {
  await openViewer(page)
  const start = (await cameraState(page)).distance

  await page.getByRole('button', { name: 'Zoom in' }).click()
  await waitForCameraToStop(page)
  const closer = (await cameraState(page)).distance
  expect(closer).toBeLessThan(start)

  await page.getByRole('button', { name: 'Zoom out' }).click()
  await waitForCameraToStop(page)
  expect((await cameraState(page)).distance).toBeGreaterThan(closer)
})

test('zooms in far enough to tell the bones of one finger apart', async ({
  page,
}) => {
  await openViewer(page)

  const scroll = async () => {
    const finger = await boneOnScreen(page, 'middle_phalanx_hand_3_left')
    await page.mouse.move(finger.x, finger.y)
    await page.mouse.wheel(0, -400)
    await waitForCameraToStop(page)
  }
  await expect
    .poll(
      async () => {
        await scroll()
        return (await cameraState(page)).distance
      },
      { timeout: 60_000 },
    )
    .toBeLessThan(0.15)

  const middle = await boneOnScreen(page, 'middle_phalanx_hand_3_left')
  const tip = await boneOnScreen(page, 'distal_phalanx_hand_3_left')
  const gap = Math.hypot(middle.x - tip.x, middle.y - tip.y)
  expect(gap).toBeGreaterThan(40)
})

test('clicking a bone names it, on the patient’s own side', async ({ page }) => {
  await openViewer(page)

  const left = await boneOnScreen(page, 'femur_left')
  await page.mouse.click(left.x, left.y)
  await expect(page.getByText('Your left femur (thigh bone)')).toBeVisible()

  const right = await boneOnScreen(page, 'femur_right')
  await page.mouse.click(right.x, right.y)
  await expect(page.getByText('Your right femur (thigh bone)')).toBeVisible()
})

test('a drag that ends on a bone does not select it', async ({ page }) => {
  await openViewer(page)
  const femur = await boneOnScreen(page, 'femur_left')

  await page.mouse.move(femur.x - 100, femur.y)
  await page.mouse.down()
  await page.mouse.move(femur.x, femur.y, { steps: 5 })
  await page.mouse.up()

  await expect(page.getByText('Click a bone to see its name.')).toBeVisible()
})
