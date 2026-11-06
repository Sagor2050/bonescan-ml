import { Suspense, useState } from 'react'
import { type Finding, type Side } from '../findings/types.ts'
import Link from '../routing/Link.tsx'
import { paths, reportPath } from '../routing/paths.ts'
import { navigate } from '../routing/router.ts'
import { boneLabel, useBones, type Bone } from '../viewer/bones.ts'
import {
  setDraftReport,
  useDraftReport,
  type DraftFinding,
  type DraftReport,
} from './draftReport.ts'
import {
  editFinding,
  examDateProblem,
  localToday,
  newFinding,
  STATUS_REASONS,
} from './findingEdits.ts'
import { saveReport } from './saveReport.ts'
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
  const reason = STATUS_REASONS[finding.status]
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
          {chosen ? boneLabel(chosen) : 'Bone not chosen'}
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

function FindingsList({
  draft,
  onChange,
}: {
  draft: DraftReport
  onChange: (findings: DraftFinding[]) => void
}) {
  const bones = useBones()
  const { findings } = draft

  return (
    <>
      {findings.length === 0 && (
        <p className={styles.reason}>
          We didn't find any fractures in this report, so the skeleton won't
          show any markers. If that doesn't look right, check your original
          report or ask your care team. You can also add a finding below.
        </p>
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

function ExamDate({
  draft,
  value,
  today,
  problem,
  onChange,
}: {
  draft: DraftReport
  value: string
  today: string
  problem: string | null
  onChange: (value: string) => void
}) {
  return (
    <section className={styles.date}>
      <h2>Date of the exam</h2>
      {draft.readerExamDate ? (
        <p>We found this date in your report. You can change it.</p>
      ) : draft.candidateDates.length > 1 ? (
        <p>Your report has several dates. Enter the date of this exam.</p>
      ) : (
        <p>We couldn't find one exam date in your report. Please enter it.</p>
      )}
      {!draft.readerExamDate && draft.candidateDates.length > 0 && (
        <ul className={styles.dateChoices}>
          {draft.candidateDates.map((date) => (
            <li key={date}>
              <button type="button" onClick={() => onChange(date)}>
                Use {date}
              </button>
            </li>
          ))}
        </ul>
      )}
      <label>
        Exam date
        <input
          type="date"
          max={today}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      {problem && <p role="alert">{problem}</p>}
    </section>
  )
}

function VerifyFindingsScreen() {
  const draft = useDraftReport()
  const today = localToday()
  const [examDate, setExamDate] = useState(draft?.readerExamDate ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (!draft) {
    return (
      <main className={styles.screen}>
        <h1>Check the findings</h1>
        <p>There's no report to check right now.</p>
        <p>
          <Link href={paths.addReport}>Add a report</Link>
        </p>
      </main>
    )
  }

  const current = draft
  const problem = examDateProblem(examDate, today)
  const fromReport =
    examDate === current.readerExamDate ||
    current.candidateDates.includes(examDate)

  async function confirm() {
    setSaving(true)
    setSaveError(null)
    try {
      const id = await saveReport(current, {
        examDate,
        source: fromReport ? 'report' : 'patient',
      })
      setDraftReport(null)
      navigate(reportPath(id))
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Your report could not be saved. Please try again.',
      )
      setSaving(false)
    }
  }

  return (
    <main className={styles.screen}>
      <h1>Check the findings</h1>
      <p>
        We read your report and listed each fracture it describes. Please check
        them before they go on the skeleton, because reading can make mistakes.
        Your care team can answer questions about your results.
      </p>

      <ExamDate
        draft={current}
        value={examDate}
        today={today}
        problem={problem}
        onChange={setExamDate}
      />

      <section>
        <h2>Fractures in your report</h2>
        <Suspense fallback={<p>Loading the list of bones…</p>}>
          <FindingsList
            draft={current}
            onChange={(findings) => setDraftReport({ ...current, findings })}
          />
        </Suspense>
      </section>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={Boolean(problem) || saving}
          onClick={confirm}
        >
          {saving ? 'Saving…' : 'Confirm and see the skeleton'}
        </button>
        {saveError && <p role="alert">{saveError}</p>}
      </div>
    </main>
  )
}

export default VerifyFindingsScreen
