import { type Finding, type Side } from '../findings/types.ts'
import { boneLabel, useBones, type Bone } from '../viewer/bones.ts'
import type { DraftFinding } from './draftReport.ts'
import {
  editFinding,
  newFinding,
  noMarkerReason,
  unplacedTitle,
} from './findingEdits.ts'
import styles from './VerifyFindingsScreen.module.css'

// The bones to choose from, once each, in the catalog's own order and words.
function uniqueBones(bones: Bone[]) {
  const seen = new Map<string, Bone>()
  for (const bone of bones) {
    if (!seen.has(bone.bone)) seen.set(bone.bone, bone)
  }
  return [...seen.values()]
}

function partLabel(part: string) {
  return part.replaceAll('_', ' ')
}

function reportWording(finding: Finding) {
  return [...new Set(finding.wording.map((piece) => piece.text))]
}

type FindingCardProps = {
  finding: DraftFinding
  number: number
  bones: Bone[]
  onChange: (next: DraftFinding) => void
  onRemove: () => void
}

function FindingCard({
  finding,
  number,
  bones,
  onChange,
  onRemove,
}: FindingCardProps) {
  const choices = uniqueBones(bones)
  const chosen = choices.find((bone) => bone.bone === finding.bone)
  const parts = chosen ? Object.keys(chosen.parts) : []
  const reason = noMarkerReason(finding)
  const name = `Finding ${number}`

  function changeBone(bone: string) {
    const entry = choices.find((choice) => choice.bone === bone)
    const kept = finding.part.filter((part) => entry && part in entry.parts)
    onChange(editFinding(finding, { bone, part: kept }))
  }

  function togglePart(part: string, on: boolean) {
    const next = on
      ? [...finding.part, part]
      : finding.part.filter((item) => item !== part)
    onChange(editFinding(finding, { part: next }))
  }

  return (
    <li className={styles.card} aria-label={name}>
      <div className={styles.cardHeader}>
        <h3>
          {chosen ? boneLabel(chosen) : unplacedTitle(finding)}
          {finding.side && `, ${finding.side} side`}
        </h3>
        <button type="button" onClick={onRemove}>
          Remove {name.toLowerCase()}
        </button>
      </div>

      <ul className={styles.labels}>
        <li>
          {finding.certainty === 'uncertain'
            ? 'Possible fracture'
            : 'Fracture'}
        </li>
        {finding.entered_by_patient && <li>Entered by you</li>}
        <li>
          {finding.status === 'placed'
            ? 'Will be marked on the skeleton'
            : 'No marker'}
        </li>
      </ul>

      {reason && <p className={styles.reason}>{reason}</p>}

      {finding.wording.length > 0 && (
        <div>
          <p className={styles.sourceLabel}>Your report says:</p>
          {reportWording(finding).map((text) => (
            <blockquote key={text}>{text}</blockquote>
          ))}
        </div>
      )}

      {finding.type_words.length > 0 && (
        <p>Words used: {finding.type_words.join(', ')}</p>
      )}
      {finding.healing_words.length > 0 && (
        <p>Healing words in your report: {finding.healing_words.join(', ')}</p>
      )}

      <div className={styles.controls}>
        <label>
          Bone
          <select
            aria-label={`Bone for ${name.toLowerCase()}`}
            value={finding.bone}
            onChange={(event) => changeBone(event.target.value)}
          >
            <option value="">Not chosen</option>
            {choices.map((bone) => (
              <option key={bone.bone} value={bone.bone}>
                {boneLabel(bone)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Side (your own left or right)
          <select
            aria-label={`Side for ${name.toLowerCase()}`}
            value={finding.side}
            onChange={(event) =>
              onChange(
                editFinding(finding, { side: event.target.value as Side }),
              )
            }
          >
            <option value="">Not chosen</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </label>
      </div>

      {parts.length > 0 && (
        <fieldset className={styles.parts}>
          <legend>Part of the bone (none means the whole bone)</legend>
          {parts.map((part) => (
            <label key={part}>
              <input
                type="checkbox"
                checked={finding.part.includes(part)}
                onChange={(event) => togglePart(part, event.target.checked)}
              />
              {partLabel(part)}
            </label>
          ))}
        </fieldset>
      )}
    </li>
  )
}

const NOTHING_FOUND =
  "We didn't find any fractures in this report, so the skeleton won't show any markers. If that doesn't look right, check your original report or ask your care team. You can also add a finding below."

// Where a patient checks and corrects findings, before a report is saved and at
// any time after (S2.3). It works on a list and leaves saving to its screen.
function FindingsEditor({
  findings,
  emptyMessage = NOTHING_FOUND,
  onChange,
}: {
  findings: DraftFinding[]
  emptyMessage?: string
  onChange: (findings: DraftFinding[]) => void
}) {
  const bones = useBones()

  return (
    <>
      {findings.length === 0 && (
        <p className={styles.reason}>{emptyMessage}</p>
      )}
      <ol className={styles.list}>
        {findings.map((finding, index) => (
          <FindingCard
            key={finding.key}
            finding={finding}
            number={index + 1}
            bones={bones}
            onChange={(next) =>
              onChange(
                findings.map((item) => (item.key === next.key ? next : item)),
              )
            }
            onRemove={() =>
              onChange(findings.filter((item) => item.key !== finding.key))
            }
          />
        ))}
      </ol>
      <button
        type="button"
        onClick={() => onChange([...findings, newFinding()])}
      >
        Add a finding we missed
      </button>
    </>
  )
}

export default FindingsEditor
