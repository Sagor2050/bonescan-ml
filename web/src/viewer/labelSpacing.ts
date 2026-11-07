// Keeps the labels on the model from covering each other (NFR12). Each marker says
// where its label would like to go, and this settles them all together.

// A marker's label for this frame, with where it would like to sit.
export type PlacedLabel = {
  label: HTMLElement
  line: SVGSVGElement
  // The marker, in pixels from the view's top left corner.
  x: number
  y: number
  // How far across from the marker the label sits, and on which side.
  gap: number
  goesLeft: boolean
  // How far below the marker the label's middle would like to be.
  height: number
}

export type LabelBox = {
  left: number
  top: number
  width: number
  height: number
  // How far down the view the label's marker is, in pixels.
  markerY: number
}

// The space to keep between two labels, in pixels.
const LABEL_SPACING = 6

// How far before the label the line bends to run straight into it, in pixels.
const LINE_BEND = 20
// Where the line to the label starts, in pixels from the dot's center.
const LINE_START = 9

// The line from the dot to its label: up and out to a bend, then straight across.
export function linePoints(gap: number, labelHeight: number) {
  const bendX = gap - LINE_BEND
  const length = Math.hypot(bendX, labelHeight)
  const startX = (bendX / length) * LINE_START
  const startY = (labelHeight / length) * LINE_START
  return `${startX},${startY} ${bendX},${labelHeight} ${gap},${labelHeight}`
}

function sideBySide(a: LabelBox, b: LabelBox) {
  return a.left + a.width <= b.left || b.left + b.width <= a.left
}

function tooClose(top: number, box: LabelBox, otherTop: number, other: LabelBox) {
  return (
    !sideBySide(box, other) &&
    top < otherTop + other.height + LABEL_SPACING &&
    top + box.height + LABEL_SPACING > otherTop
  )
}

// Where each label's top should go, in the same order as `boxes`. Labels in the same
// column keep the order of their markers, top to bottom, so their lines don't cross.
// A label that's in another's way moves down, and labels that reach the bottom limit
// move back up. The top limit always wins, so with too many labels to fit, some may
// still overlap.
export function spreadLabels(
  boxes: LabelBox[],
  limits: { top: number; bottom: number },
) {
  const tops = boxes.map((box) => Math.max(box.top, limits.top))
  const downward = boxes
    .map((_box, index) => index)
    .sort((a, b) => boxes[a].markerY - boxes[b].markerY || a - b)

  const settled: number[] = []
  for (const index of downward) {
    const box = boxes[index]
    let moved = true
    while (moved) {
      moved = false
      for (const other of settled) {
        const clearBelow = tops[other] + boxes[other].height + LABEL_SPACING
        if (!sideBySide(box, boxes[other]) && tops[index] < clearBelow) {
          tops[index] = clearBelow
          moved = true
        }
      }
    }
    settled.push(index)
  }

  const upward = [...downward].sort((a, b) => tops[b] - tops[a] || b - a)
  settled.length = 0
  for (const index of upward) {
    const box = boxes[index]
    tops[index] = Math.min(tops[index], limits.bottom - box.height)
    let moved = true
    while (moved) {
      moved = false
      for (const other of settled) {
        if (tooClose(tops[index], box, tops[other], boxes[other])) {
          tops[index] = tops[other] - box.height - LABEL_SPACING
          moved = true
        }
      }
    }
    tops[index] = Math.max(tops[index], limits.top)
    settled.push(index)
  }
  return tops
}
