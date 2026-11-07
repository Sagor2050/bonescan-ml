import { describe, expect, test } from 'vitest'
import { spreadLabels, type LabelBox } from './labelSpacing.ts'

const limits = { top: 64, bottom: 600 }

function box(
  top: number,
  left = 100,
  height = 80,
  width = 150,
  markerY = top,
): LabelBox {
  return { left, top, width, height, markerY }
}

function overlapping(boxes: LabelBox[], tops: number[]) {
  return boxes.flatMap((a, i) =>
    boxes.slice(i + 1).flatMap((b, offset) => {
      const j = i + 1 + offset
      const acrossApart = a.left + a.width <= b.left || b.left + b.width <= a.left
      const downApart =
        tops[i] + a.height <= tops[j] || tops[j] + b.height <= tops[i]
      return acrossApart || downApart ? [] : [[i, j]]
    }),
  )
}

describe('spreadLabels', () => {
  test('labels that are already clear stay where they are', () => {
    const boxes = [box(100), box(300)]
    expect(spreadLabels(boxes, limits)).toEqual([100, 300])
  })

  test('a label in another’s way moves down, and keeps its order', () => {
    const boxes = [box(100), box(130)]
    const [first, second] = spreadLabels(boxes, limits)
    expect(first).toBe(100)
    expect(second).toBeGreaterThanOrEqual(180)
  })

  test('the order follows where they want to be, not the order given', () => {
    const boxes = [box(130), box(100)]
    const [lower, upper] = spreadLabels(boxes, limits)
    expect(upper).toBe(100)
    expect(lower).toBeGreaterThanOrEqual(180)
  })

  test('labels pushed to the top limit keep their markers’ order', () => {
    const lowerMarker = box(10, 100, 80, 150, 300)
    const higherMarker = box(10, 100, 80, 150, 100)
    const [lower, higher] = spreadLabels([lowerMarker, higherMarker], limits)
    expect(higher).toBe(64)
    expect(lower).toBeGreaterThanOrEqual(144)
  })

  test('a tall label doesn’t jump above the label of a higher marker', () => {
    const higherMarker = box(200, 100, 60, 150, 250)
    const tallLowerMarker = box(120, 100, 200, 150, 300)
    const [higher, tall] = spreadLabels([higherMarker, tallLowerMarker], limits)
    expect(tall).toBeGreaterThanOrEqual(higher + 60)
  })

  test('labels side by side don’t move each other', () => {
    const boxes = [box(100, 100), box(110, 400)]
    expect(spreadLabels(boxes, limits)).toEqual([100, 110])
  })

  test('labels at the same spot all end up apart', () => {
    const boxes = [box(200), box(200), box(200), box(200)]
    expect(overlapping(boxes, spreadLabels(boxes, limits))).toEqual([])
  })

  test('a label stays below the top limit, clear of the notice', () => {
    expect(spreadLabels([box(10)], limits)).toEqual([64])
  })

  test('labels that reach the bottom move back up, still apart', () => {
    const boxes = [box(500), box(510), box(520)]
    const tops = spreadLabels(boxes, limits)
    expect(overlapping(boxes, tops)).toEqual([])
    tops.forEach((top) => expect(top + 80).toBeLessThanOrEqual(600))
  })

  test('with too many to fit, none goes above the top limit', () => {
    const boxes = Array.from({ length: 20 }, () => box(200))
    spreadLabels(boxes, limits).forEach((top) =>
      expect(top).toBeGreaterThanOrEqual(64),
    )
  })

  test('the same labels always settle the same way', () => {
    const boxes = [box(200), box(205), box(190, 180)]
    expect(spreadLabels(boxes, limits)).toEqual(spreadLabels(boxes, limits))
  })
})
