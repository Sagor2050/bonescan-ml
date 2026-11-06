import type { Certainty } from '../findings/types.ts'
import { boneId } from '../findings/types.ts'
import type { SavedFinding } from '../workspace/reportStore.ts'
import { boneLabel, type Bone, type Point } from './bones.ts'

export type MarkerSpec = {
  findingId: string
  boneId: string
  // The named part's point from bones.json, or null to mark the whole bone.
  point: Point | null
  certainty: Certainty
  title: string
  boneName: string
  sideLabel: string
  enteredByPatient: boolean
  // How many earlier markers sit on the same spot, so labels can stack.
  stackIndex: number
}

export const CERTAINTY_TITLES: Record<Certainty, string> = {
  certain: 'Fracture',
  uncertain: 'Possible fracture',
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

// One marker for each finding that can be placed (S3.1). The rest get none, and
// the findings list says why (S2.4).
export function markersFor(findings: SavedFinding[], bones: Bone[]) {
  const byId = new Map(bones.map((bone) => [bone.id, bone]))
  const spots = new Map<string, number>()
  const markers: MarkerSpec[] = []

  for (const finding of findings) {
    const id = boneId(finding)
    const bone = id ? byId.get(id) : undefined
    if (!bone) continue

    const point = partPoint(finding, bone)
    const spot = `${bone.id}:${point?.join(',') ?? 'whole'}`
    const stackIndex = spots.get(spot) ?? 0
    spots.set(spot, stackIndex + 1)

    markers.push({
      findingId: finding.id,
      boneId: bone.id,
      point,
      certainty: finding.certainty,
      title: CERTAINTY_TITLES[finding.certainty],
      boneName: boneLabel(bone),
      sideLabel: `Your ${bone.side} side`,
      enteredByPatient: finding.entered_by_patient,
      stackIndex,
    })
  }
  return markers
}

// The gap between a marker and its label, and the label's limits, in pixels.
const LABEL_GAP = 20
const LABEL_MIN_WIDTH = 110
const LABEL_MAX_WIDTH = 208

// A label points away from the middle of the view, so it covers fewer bones, and
// narrows to fit before the edge cuts it off. Only when even that is too tight
// does it point inward. `x` runs from -1 to 1 across the view.
export function labelPlacement(x: number, viewWidth: number) {
  const fromCenter = (Math.abs(x) * viewWidth) / 2
  const outside = viewWidth / 2 - fromCenter - LABEL_GAP
  const inside = viewWidth / 2 + fromCenter - LABEL_GAP
  const pointsOutward = outside >= LABEL_MIN_WIDTH
  return {
    goesLeft: x < 0 ? pointsOutward : !pointsOutward,
    maxWidth: Math.min(LABEL_MAX_WIDTH, pointsOutward ? outside : inside),
  }
}
