import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { markerInfo, openViewer } from './viewer.ts'

const bones = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../public/shared/bones.json'),
    'utf8',
  ),
) as { id: string; medical: string; side: string; parts: Record<string, number[]> }[]

const model = (page: Page) => page.getByRole('region', { name: '3D skeleton' })

test('labels a marker for each named part of the chosen bone', async ({
  page,
}) => {
  await openViewer(page, '/dev/marker-points')
  await page.getByRole('combobox').selectOption({ label: 'femur' })

  const femur = bones.find((bone) => bone.id === 'femur_left')
  if (!femur) throw new Error('No femur_left')
  for (const part of Object.keys(femur.parts)) {
    const info = await markerInfo(page, `part:femur_left:${part}`)
    expect(info.bone).toBe('femur_left')
  }
  await expect(model(page).getByRole('button', { name: /^neck/ })).toBeVisible()
})

test('moves between bones', async ({ page }) => {
  await openViewer(page, '/dev/marker-points')
  const select = page.getByRole('combobox')
  const first = await select.inputValue()
  await page.getByRole('button', { name: 'Next bone' }).click()
  expect(await select.inputValue()).not.toBe(first)
  await page.getByRole('button', { name: 'Previous bone' }).click()
  expect(await select.inputValue()).toBe(first)
})

test('every named point sits within its own bone', async ({ page }) => {
  await openViewer(page, '/dev/marker-points')
  const outside = await page.evaluate((catalog) => {
    type Vector = { x: number; y: number; z: number }
    type Scene = {
      getObjectByName: (name: string) => unknown
    }
    const hook = (
      globalThis as unknown as {
        __bonescanViewer: { scene: Scene }
      }
    ).__bonescanViewer
    type Node = {
      isMesh?: boolean
      material?: { isMeshStandardMaterial?: boolean }
      geometry?: {
        boundingBox: { min: Vector; max: Vector } | null
        computeBoundingBox: () => void
      }
      matrixWorld: { elements: number[] }
      traverse: (visit: (node: Node) => void) => void
    }
    const problems: string[] = []
    for (const entry of catalog) {
      const bone = hook.scene.getObjectByName(entry.id) as Node
      const low = [Infinity, Infinity, Infinity]
      const high = [-Infinity, -Infinity, -Infinity]
      bone.traverse((node) => {
        if (!node.isMesh || !node.material?.isMeshStandardMaterial) return
        const geometry = node.geometry
        if (!geometry) return
        geometry.computeBoundingBox()
        const box = geometry.boundingBox
        if (!box) return
        const e = node.matrixWorld.elements
        for (const x of [box.min.x, box.max.x]) {
          for (const y of [box.min.y, box.max.y]) {
            for (const z of [box.min.z, box.max.z]) {
              const world = [
                e[0] * x + e[4] * y + e[8] * z + e[12],
                e[1] * x + e[5] * y + e[9] * z + e[13],
                e[2] * x + e[6] * y + e[10] * z + e[14],
              ]
              world.forEach((value, axis) => {
                low[axis] = Math.min(low[axis], value)
                high[axis] = Math.max(high[axis], value)
              })
            }
          }
        }
      })
      for (const [part, point] of Object.entries(entry.parts)) {
        const margin = 0.002
        point.forEach((value, axis) => {
          if (value < low[axis] - margin || value > high[axis] + margin) {
            problems.push(`${entry.id}.${part}`)
          }
        })
      }
    }
    return problems
  }, bones)
  expect(outside).toEqual([])
})
