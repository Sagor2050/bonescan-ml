import { useFrame } from '@react-three/fiber'
import { LABEL_TOP_CLEARANCE } from './markers.ts'
import {
  linePoints,
  spreadLabels,
  type LabelBox,
  type PlacedLabel,
} from './labelSpacing.ts'

// Keeps a label clear of the view controls along the bottom, in pixels.
const LABEL_BOTTOM_CLEARANCE = 60

// Settles every label once all the markers have said where theirs would like to go.
// A marker out of view has its label out of view too, so it's left out: pulling that
// label in would draw a line to nothing.
function LabelLayout({ labels }: { labels: Map<string, PlacedLabel> }) {
  useFrame(({ size }) => {
    const placed = [...labels.values()]
    const boxes: LabelBox[] = placed.map(({ label, x, y, gap, goesLeft, height }) => {
      const width = label.offsetWidth
      const labelHeight = label.offsetHeight
      return {
        left: goesLeft ? x - gap - width : x + gap,
        top: y + height - labelHeight / 2,
        width,
        height: labelHeight,
        markerY: y,
      }
    })

    const inView = placed.flatMap(({ x, y }, index) =>
      x >= 0 && x <= size.width && y >= 0 && y <= size.height ? [index] : [],
    )
    const tops = boxes.map((box) => box.top)
    spreadLabels(
      inView.map((index) => boxes[index]),
      {
        top: LABEL_TOP_CLEARANCE,
        bottom: size.height - LABEL_BOTTOM_CLEARANCE,
      },
    ).forEach((top, position) => {
      tops[inView[position]] = top
    })

    placed.forEach(({ label, line, y, gap }, index) => {
      const height = tops[index] + boxes[index].height / 2 - y
      label.style.setProperty('--height', `${height}px`)
      line
        .querySelector('polyline')
        ?.setAttribute('points', linePoints(gap, height))
    })
  })
  return null
}

export default LabelLayout
