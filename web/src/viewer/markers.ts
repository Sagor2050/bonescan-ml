import type { Certainty } from '../findings/types.ts'
import { boneId } from '../findings/types.ts'
import { healingLines } from '../workspace/healingStatus.ts'
import type { SavedFinding } from '../workspace/reportStore.ts'
import { boneLabel, type Bone, type Point } from './bones.ts'

export type MarkerLook = {
  shape: 'round' | 'diamond' | 'cube' | 'cone'
  fill: string
  // The same shape as text, for the label.
  glyph: string
}

export type MarkerSpec = {
  findingId: string
  boneId: string
  // The named part's point from bones.json, or null to mark the whole bone.
  point: Point | null
  certainty: Certainty
  look: MarkerLook
  title: string
  // A second heading line, used when the title says something else, as a
  // comparison's does.
  subtitle: string | null
  boneName: string
  sideLabel: string
  // The report's healing words with their labels; empty if it has none (S5.3).
  healing: string[]
  enteredByPatient: boolean
  // How many earlier markers sit on the same spot, so labels can stack.
  stackIndex: number
}

export const CERTAINTY_TITLES: Record<Certainty, string> = {
  certain: 'Fracture',
  uncertain: 'Possible fracture',
}

// Certain and uncertain findings differ by shape, so the difference survives
// without color (S3.1, NFR12).
const CERTAINTY_LOOKS: Record<Certainty, MarkerLook> = {
  certain: { shape: 'round', fill: '#e5352b', glyph: '●' },
  uncertain: { shape: 'diamond', fill: '#ffb000', glyph: '◆' },
}

// The first part the finding names that the catalog has a point for. A part the
// catalog doesn't know marks the whole bone rather than guessing a spot (NFR5).
function partPoint(finding: SavedFinding, bone: Bone): Point | null {
  for (const part of finding.part) {
    const point = bone.parts[part]
    if (point) return point
  }
  return null
}

// Numbers the markers that share a spot, so their labels can stack.
export function withStackIndexes(markers: MarkerSpec[]) {
  const spots = new Map<string, number>()
  return markers.map((marker) => {
    const spot = `${marker.boneId}:${marker.point?.join(',') ?? 'whole'}`
    const stackIndex = spots.get(spot) ?? 0
    spots.set(spot, stackIndex + 1)
    return { ...marker, stackIndex }
  })
}

// One marker for each finding that can be placed (S3.1). The rest get none, and
// the findings list says why (S2.4).
export function markersFor(findings: SavedFinding[], bones: Bone[]) {
  const byId = new Map(bones.map((bone) => [bone.id, bone]))
  const markers: MarkerSpec[] = []

  for (const finding of findings) {
    const id = boneId(finding)
    const bone = id ? byId.get(id) : undefined
    if (!bone) continue

    markers.push({
      findingId: finding.id,
      boneId: bone.id,
      point: partPoint(finding, bone),
      certainty: finding.certainty,
      look: CERTAINTY_LOOKS[finding.certainty],
      title: CERTAINTY_TITLES[finding.certainty],
      subtitle: null,
      boneName: boneLabel(bone),
      sideLabel: `Your ${bone.side} side`,
      healing: healingLines(finding.healing_words),
      enteredByPatient: finding.entered_by_patient,
      stackIndex: 0,
    })
  }
  return withStackIndexes(markers)
}

// How far a label sits from its marker, in pixels: well clear of the bone when
// there's room, and closer when there isn't. Its width limits, too.
export const LABEL_FAR_GAP = 140
export const LABEL_MIN_GAP = 40
export const LABEL_MIN_WIDTH = 110
const LABEL_MAX_WIDTH = 208
// The room to leave for a typical label when deciding how far out it can go.
const LABEL_USUAL_WIDTH = 176
const LABEL_EDGE_MARGIN = 6

// How far above its marker a label sits, in pixels, when there's room.
export const LABEL_RISE = 72
// Keeps a label clear of the notice across the top of the view, in pixels.
const LABEL_TOP_CLEARANCE = 64

// How far down each label sits from the one above it when markers share a spot.
export const LABEL_STACK_GAP = 120

// How far past the point where a label would change sides a marker must move, in
// pixels, before it does. Without this, a marker near that point makes its label
// jump from side to side as the camera moves (#87).
const LABEL_KEEP_SIDE = 48

function roomOnSide(goesLeft: boolean, x: number, viewWidth: number) {
  return ((goesLeft ? 1 + x : 1 - x) * viewWidth) / 2
}

// Away from the middle of the body, so a label doesn't land on the other arm or leg.
// Only when there's too little room for that does it point inward.
function preferredSide(x: number, viewWidth: number, bodyCenter: number) {
  const outwardLeft = x < bodyCenter
  const fits =
    roomOnSide(outwardLeft, x, viewWidth) - LABEL_MIN_GAP >= LABEL_MIN_WIDTH
  return fits ? outwardLeft : !outwardLeft
}

// Where a label goes, how far from its marker, and how wide it can be before the
// edge cuts it off. `x` and `bodyCenter` run from -1 to 1 across the view.
// `currentlyLeft` is the side it's on now, if any.
export function labelPlacement(
  x: number,
  viewWidth: number,
  currentlyLeft?: boolean,
  bodyCenter = 0,
) {
  const shift = (2 * LABEL_KEEP_SIDE) / viewWidth
  const keepsSide =
    preferredSide(x - shift, viewWidth, bodyCenter) === currentlyLeft ||
    preferredSide(x + shift, viewWidth, bodyCenter) === currentlyLeft
  const goesLeft = keepsSide
    ? (currentlyLeft as boolean)
    : preferredSide(x, viewWidth, bodyCenter)

  const room = roomOnSide(goesLeft, x, viewWidth) - LABEL_EDGE_MARGIN
  const gap = Math.min(
    LABEL_FAR_GAP,
    Math.max(LABEL_MIN_GAP, room - LABEL_USUAL_WIDTH),
  )
  return { goesLeft, gap, maxWidth: Math.min(LABEL_MAX_WIDTH, room - gap) }
}

// How far above its marker a label sits, in pixels. It's lower near the top of the
// view, and below the marker when it has to be, so it never covers the notice saying
// this is a standard skeleton (NFR5). `y` runs from -1 at the bottom to 1 at the top.
export function labelRise(y: number, viewHeight: number, labelHeight: number) {
  const fromTop = ((1 - y) * viewHeight) / 2
  const room = fromTop - LABEL_TOP_CLEARANCE - labelHeight / 2
  return Math.max(-LABEL_RISE, Math.min(LABEL_RISE, room))
}
