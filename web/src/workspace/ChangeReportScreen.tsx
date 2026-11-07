import { Suspense, useState } from 'react'
import type { DraftFinding } from '../add-report/draftReport.ts'
import { examDateProblem, localToday } from '../add-report/findingEdits.ts'
import FindingsEditor from '../add-report/FindingsEditor.tsx'
import Link from '../routing/Link.tsx'
import { reportPath } from '../routing/paths.ts'
import { navigate } from '../routing/router.ts'
import styles from './ChangeReportScreen.module.css'
import { saveReportChanges, type SavedReport } from './reportStore.ts'
import { useReport } from './useReport.ts'
import { useWorkspace } from './workspaceState.ts'

function ChangeForm({ report }: { report: SavedReport }) {
  const { clearSelection } = useWorkspace()
  const today = localToday()
  const [examDate, setExamDate] = useState(report.exam_date)
  const [findings, setFindings] = useState<DraftFinding[]>(() =>
    report.findings.map(({ id, report_id: _report, position: _p, ...finding }) => ({
      ...finding,
      key: id,
    })),
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const problem = examDateProblem(examDate, today)

  async function save() {
    setSaving(true)
    setSaveError(null)
    try {
      await saveReportChanges(report, { examDate, findings })
      // A finding that was selected may have just been removed.
      clearSelection()
      navigate(reportPath(report.id))
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Your changes could not all be saved. Please check this report and try again.',
      )
      setSaving(false)
    }
  }

  return (
    <>
      <section className={styles.date}>
        <h2>Date of the exam</h2>
        <p>Your reports are listed in order of this date.</p>
        <label>
          Exam date
          <input
            type="date"
            max={today}
            value={examDate}
            onChange={(event) => setExamDate(event.target.value)}
          />
        </label>
        {problem && <p role="alert">{problem}</p>}
      </section>

      <section>
        <h2>Fractures in this report</h2>
        <Suspense fallback={<p>Loading the list of bones…</p>}>
          <FindingsEditor
            findings={findings}
            emptyMessage="This report has no findings listed, so the skeleton won't show any markers. You can add a finding below."
            onChange={setFindings}
          />
        </Suspense>
      </section>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={Boolean(problem) || saving}
          onClick={save}
        >
          {saving ? 'Saving…' : 'Save my changes'}
        </button>
        <Link href={reportPath(report.id)}>Cancel</Link>
        {saveError && <p role="alert">{saveError}</p>}
      </div>
    </>
  )
}

// Corrects a report after it's saved, at any time (S1.2, S2.3). The original report
// stays exactly as it was added (NFR4).
function ChangeReportScreen({ reportId }: { reportId: string }) {
  const report = useReport(reportId)

  return (
    <main className={styles.screen}>
      <h1>Change the date or findings</h1>
      <p>
        You can correct the exam date and the findings here. This doesn't change
        your original report. Anything you add or change is labeled as entered
        by you. Your care team can answer questions about your results.
      </p>
      {report.status === 'loading' && <p>Loading your report…</p>}
      {report.status === 'missing' && <p>We can't find that report.</p>}
      {report.status === 'failed' && (
        <p>We couldn't load your report. Please try again.</p>
      )}
      {report.status === 'ready' && <ChangeForm report={report.report} />}
    </main>
  )
}

export default ChangeReportScreen
