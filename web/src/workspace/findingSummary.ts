import type { Finding, Status } from '../findings/types.ts'
import { boneId } from '../findings/types.ts'
import { boneLabel, type Bone } from '../viewer/bones.ts'
import { CERTAINTY_TITLES } from '../viewer/markers.ts'
import { healingLines } from './healingStatus.ts'
import { PATIENT_WORDING, type Wording } from './readOnly.ts'

// S2.4: why a finding has no marker, in the requirements' own terms.
function noMarkerReasons(
  wording: Wording,
): Record<Exclude<Status, 'placed'>, string> {
  return {
    outside_coverage:
      'Outside the bones this app covers. No marker is shown on the model.',
    side_not_stated: wording.sideNotStated,
    bone_not_stated: wording.boneNotStated,
  }
}

function partWords(part: string) {
  return part.replaceAll('_', ' ')
}

// What the findings list says about one finding. All of it comes from the
// finding, the catalog, or the fixed text above.
export function findingSummary(
  finding: Finding,
  bones: Bone[],
  wording: Wording = PATIENT_WORDING,
) {
  const id = boneId(finding)
  const placedBone = id ? bones.find((bone) => bone.id === id) : undefined
  // A finding with no side still names a bone, and both sides share its names.
  const namedBone =
    placedBone ?? bones.find((bone) => bone.bone === finding.bone)
  const reasons = noMarkerReasons(wording)

  return {
    title: CERTAINTY_TITLES[finding.certainty],
    boneName: namedBone ? boneLabel(namedBone) : null,
    sideLabel: placedBone ? `${wording.owner} ${placedBone.side} side` : null,
    parts: finding.part.map(partWords).join(', '),
    reportWords: finding.type_words.join(', '),
    healing: healingLines(finding.healing_words),
    noMarkerReason: placedBone
      ? null
      : finding.status === 'placed'
        ? reasons.outside_coverage
        : reasons[finding.status],
    // A finding with no bone name is identified by the report's own sentence.
    reportSentence: namedBone ? null : (finding.wording[0]?.text ?? null),
    enteredByPatient: finding.entered_by_patient,
  }
}
