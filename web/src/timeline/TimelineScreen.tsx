import { lazy, Suspense } from 'react'
import Link from '../routing/Link.tsx'
import { paths, reportPath } from '../routing/paths.ts'
import { useBones } from '../viewer/bones.ts'
import { formatExamDate } from '../workspace/examDate.ts'
import FindingsList from '../workspace/FindingsList.tsx'
import type { SavedReport } from '../workspace/reportStore.ts'
import { useReports } from '../workspace/useReports.ts'
import { useWorkspace } from '../workspace/workspaceState.ts'
import { reportBones } from './reportBones.ts'
import styles from './TimelineScreen.module.css'

// The 3D code is large, so it loads only when there is a report to show.
const SkeletonViewer = lazy(() => import('../viewer/SkeletonViewer.tsx'))

function ReportHistory({
  reports,
  shownId,
}: {
  reports: SavedReport[]
  shownId: string
}) {
  const bones = useBones()
  const { showReport } = useWorkspace()

  return (
    <ol className={styles.history}>
      {reports.map((report) => {
        const names = reportBones(report.findings, bones)
        return (
          <li key={report.id}>
            <button
              className={styles.report}
              aria-pressed={report.id === shownId}
              onClick={() => showReport(report.id)}
            >
              <strong>{formatExamDate(report.exam_date)}</strong>
              <span>
                {names.length > 0 ? names.join(', ') : 'No bones listed'}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function Timeline({ reports }: { reports: SavedReport[] }) {
  const { timelineReportId, showReport } = useWorkspace()
  // Starts on the latest report, the one a returning patient has most likely
  // come to see.
  const shownIndex = Math.max(
    reports.findIndex((report) => report.id === timelineReportId),
    timelineReportId === null ? reports.length - 1 : 0,
  )
  const shown = reports[shownIndex]
  const older = reports[shownIndex - 1]
  const newer = reports[shownIndex + 1]

  return (
    <div className={styles.layout}>
      <div className={styles.side}>
        <h2>Oldest exam first</h2>
        <ReportHistory reports={reports} shownId={shown.id} />
      </div>

      <section
        className={styles.shown}
        aria-label={`Report from ${formatExamDate(shown.exam_date)}`}
      >
        <div className={styles.shownHeading}>
          <h2>{formatExamDate(shown.exam_date)}</h2>
          <span className={styles.position}>
            Report {shownIndex + 1} of {reports.length}
          </span>
          <button disabled={!older} onClick={() => showReport(older.id)}>
            Older
          </button>
          <button disabled={!newer} onClick={() => showReport(newer.id)}>
            Newer
          </button>
          <Link className={styles.open} href={reportPath(shown.id)}>
            Open with the original report
          </Link>
        </div>
        <div className={styles.panes}>
          <SkeletonViewer findings={shown.findings} />
          <FindingsList findings={shown.findings} />
        </div>
      </section>
    </div>
  )
}

// Recovery Timeline (Plan A.6): reports by exam date, with the model following
// whichever report is shown (S5.1).
function TimelineScreen() {
  const reports = useReports()

  return (
    <main className={styles.screen}>
      <div className={styles.heading}>
        <h1>My reports</h1>
        <Link className={styles.add} href={paths.addReport}>
          Add a report
        </Link>
      </div>

      {reports.status === 'loading' && <p>Loading your reports…</p>}
      {reports.status === 'failed' && (
        <p>We couldn't load your reports. Please try again.</p>
      )}
      {reports.status === 'ready' && reports.reports.length === 0 && (
        <div className={styles.empty}>
          <h2>No reports yet</h2>
          <p>Add your first report to see it on the skeleton.</p>
        </div>
      )}
      {reports.status === 'ready' && reports.reports.length > 0 && (
        <Suspense fallback={<p>Loading the skeleton…</p>}>
          <Timeline reports={reports.reports} />
        </Suspense>
      )}
    </main>
  )
}

export default TimelineScreen
