import { Suspense, useState } from 'react'
import Link from '../routing/Link.tsx'
import { paths, reportPath } from '../routing/paths.ts'
import { navigate } from '../routing/router.ts'
import {
  setDraftReport,
  useDraftReport,
  type DraftReport,
} from './draftReport.ts'
import { examDateProblem, localToday } from './findingEdits.ts'
import FindingsEditor from './FindingsEditor.tsx'
import { saveReport } from './saveReport.ts'
import styles from './VerifyFindingsScreen.module.css'

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
          <FindingsEditor
            findings={current.findings}
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
