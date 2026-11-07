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

// The gap between a marker and its label, and the label's limits, in pixels.
const LABEL_GAP = 20
const LABEL_MIN_WIDTH = 110
const LABEL_MAX_WIDTH = 208

// How far past the point where a label would change sides a marker must move, in
// pixels, before it does. Without this, a marker near that point makes its label
// jump from side to side as the camera moves (#87).
const LABEL_KEEP_SIDE = 48

// Away from the middle of the view, so a label covers fewer bones. Only when there's
// too little room for that does it point inward.
function preferredSide(x: number, viewWidth: number) {
  const fromCenter = (Math.abs(x) * viewWidth) / 2
  const outside = viewWidth / 2 - fromCenter - LABEL_GAP
  const pointsOutward = outside >= LABEL_MIN_WIDTH
  return x < 0 ? pointsOutward : !pointsOutward
}

// Where a label goes, and how wide it can be before the edge cuts it off. `x` runs
// from -1 to 1 across the view. `currentlyLeft` is the side it's on now, if any.
export function labelPlacement(
  x: number,
  viewWidth: number,
  currentlyLeft?: boolean,
) {
  const shift = (2 * LABEL_KEEP_SIDE) / viewWidth
  const keepsSide =
    preferredSide(x - shift, viewWidth) === currentlyLeft ||
    preferredSide(x + shift, viewWidth) === currentlyLeft
  const goesLeft = keepsSide
    ? (currentlyLeft as boolean)
    : preferredSide(x, viewWidth)

  const room = ((goesLeft ? 1 + x : 1 - x) * viewWidth) / 2 - LABEL_GAP
  return { goesLeft, maxWidth: Math.min(LABEL_MAX_WIDTH, room) }
}
