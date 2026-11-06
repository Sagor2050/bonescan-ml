import type { Bone } from '../viewer/bones.ts'
import type { SavedFinding } from '../workspace/reportStore.ts'

// The bones a report involves, each named once with its side, for the timeline
// (S5.1). A finding with no bone or no side still shows what it does name.
export function reportBones(findings: SavedFinding[], bones: Bone[]) {
  const names = new Set<string>()
  for (const finding of findings) {
    const bone = bones.find((entry) => entry.bone === finding.bone)
    if (!bone) continue
    names.add(finding.side ? `${finding.side} ${bone.medical}` : bone.medical)
  }
  return [...names]
}
