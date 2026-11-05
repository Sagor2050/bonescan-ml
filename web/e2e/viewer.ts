import { expect, type Page } from '@playwright/test'

// Reads the camera and the scene through the hook SkeletonViewer adds in
// development. The page runs these callbacks, so they name their own types.

type Vector = {
  x: number
  y: number
  clone: () => Vector
  project: (camera: unknown) => Vector
}
type Hook = {
  camera: { position: Vector & { z: number } }
  scene: {
    getObjectByName: (name: string) => {
      children: unknown[]
      getWorldPosition: (target: Vector) => Vector
    } | null
  }
  controls: { distance: number; azimuthAngle: number; active: boolean }
}
type HookHolder = {
  __bonescanViewer?: Hook
  document: {
    querySelector: (selector: string) => {
      getBoundingClientRect: () => {
        left: number
        top: number
        width: number
        height: number
      }
    } | null
  }
}

export async function openViewer(page: Page, path = '/reports/sample') {
  await page.goto(path)
  await expect
    .poll(() =>
      page.evaluate(() => {
        const hook = (globalThis as unknown as HookHolder).__bonescanViewer
        return Boolean(hook?.controls && hook.scene.getObjectByName('femur_left'))
      }),
    )
    .toBe(true)
}

export async function waitForCameraToStop(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const hook = (globalThis as unknown as HookHolder).__bonescanViewer
        return hook ? hook.controls.active : true
      }),
    )
    .toBe(false)
}

// Where a bone's center appears, in page pixels, and as -1 to 1 across the view.
export function boneOnScreen(page: Page, id: string) {
  return page.evaluate((boneId) => {
    const holder = globalThis as unknown as HookHolder
    const hook = holder.__bonescanViewer
    const bone = hook?.scene.getObjectByName(boneId)
    if (!hook || !bone) throw new Error(`No bone ${boneId}`)
    const canvas = holder.document.querySelector('canvas')
    if (!canvas) throw new Error('No canvas')
    const rect = canvas.getBoundingClientRect()
    const ndc = bone
      .getWorldPosition(hook.camera.position.clone())
      .project(hook.camera)
    return {
      ndcX: ndc.x,
      ndcY: ndc.y,
      x: rect.left + ((ndc.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - ndc.y) / 2) * rect.height,
    }
  }, id)
}

export function cameraState(page: Page) {
  return page.evaluate(() => {
    const hook = (globalThis as unknown as HookHolder).__bonescanViewer
    if (!hook) throw new Error('No viewer')
    return {
      x: hook.camera.position.x,
      z: hook.camera.position.z,
      distance: hook.controls.distance,
      azimuth: hook.controls.azimuthAngle,
    }
  })
}
