import type { Finding, Status } from '../findings/types.ts'
import { boneId } from '../findings/types.ts'
import { boneLabel, type Bone } from '../viewer/bones.ts'
import { CERTAINTY_TITLES } from '../viewer/markers.ts'

// S2.4: why a finding has no marker, in the requirements' own terms.
const NO_MARKER_REASONS: Record<Exclude<Status, 'placed'>, string> = {
  outside_coverage:
    'Outside the bones this app covers. No marker is shown on the model.',
  side_not_stated:
    'Side not stated. No marker is shown until you set the side.',
  bone_not_stated:
    'Bone not stated. No marker is shown until you choose the bone.',
}

function partWords(part: string) {
  return part.replaceAll('_', ' ')
}

// What the findings list says about one finding. All of it comes from the
// finding, the catalog, or the fixed text above.
export function findingSummary(finding: Finding, bones: Bone[]) {
  const id = boneId(finding)
  const placedBone = id ? bones.find((bone) => bone.id === id) : undefined
  // A finding with no side still names a bone, and both sides share its names.
  const namedBone =
    placedBone ?? bones.find((bone) => bone.bone === finding.bone)

  return {
    title: CERTAINTY_TITLES[finding.certainty],
    boneName: namedBone ? boneLabel(namedBone) : null,
    sideLabel: placedBone ? `Your ${placedBone.side} side` : null,
    parts: finding.part.map(partWords).join(', '),
    reportWords: finding.type_words.join(', '),
    noMarkerReason: placedBone
      ? null
      : finding.status === 'placed'
        ? NO_MARKER_REASONS.outside_coverage
        : NO_MARKER_REASONS[finding.status],
    // A finding with no bone name is identified by the report's own sentence.
    reportSentence: namedBone ? null : (finding.wording[0]?.text ?? null),
    enteredByPatient: finding.entered_by_patient,
  }
}
