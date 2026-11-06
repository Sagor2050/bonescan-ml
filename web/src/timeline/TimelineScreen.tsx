import { lazy, Suspense, useMemo } from 'react'
import Link from '../routing/Link.tsx'
import { paths, reportPath } from '../routing/paths.ts'
import { useBones } from '../viewer/bones.ts'
import { markersFor } from '../viewer/markers.ts'
import { formatExamDate } from '../workspace/examDate.ts'
import FindingsList from '../workspace/FindingsList.tsx'
import type { SavedReport } from '../workspace/reportStore.ts'
import { useReports } from '../workspace/useReports.ts'
import { useWorkspace } from '../workspace/workspaceState.ts'
import { comparedReports, comparisonMarkers, type Comparison } from './comparison.ts'
import ComparisonList from './ComparisonList.tsx'
import { reportBones } from './reportBones.ts'
import styles from './TimelineScreen.module.css'

// The 3D code is large, so it loads only when there is a report to show.
const SkeletonViewer = lazy(() => import('../viewer/SkeletonViewer.tsx'))

function ReportHistory({
  reports,
  shownId,
  comparison,
}: {
  reports: SavedReport[]
  shownId: string
  comparison: Comparison | null
}) {
  const bones = useBones()
  const { showReport } = useWorkspace()

  return (
    <ol className={styles.history}>
      {reports.map((report) => {
        const names = reportBones(report.findings, bones)
        const tag =
          report.id === comparison?.earlier.id
            ? 'Earlier'
            : report.id === comparison?.later.id
              ? 'Later'
              : null
        return (
          <li key={report.id}>
            <button
              className={styles.report}
              aria-pressed={comparison ? tag !== null : report.id === shownId}
              onClick={() => showReport(report.id)}
            >
              <strong>
                {formatExamDate(report.exam_date)}
                {tag && <span className={styles.tag}> ({tag})</span>}
              </strong>
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

function ReportPicker({
  label,
  reports,
  chosenId,
  otherId,
  onChoose,
}: {
  label: string
  reports: SavedReport[]
  chosenId: string
  // The report chosen in the other picker. A report can't be compared with itself.
  otherId: string
  onChoose: (reportId: string) => void
}) {
  const bones = useBones()
  return (
    <label className={styles.picker}>
      {label}
      <select
        value={chosenId}
        onChange={(event) => onChoose(event.target.value)}
      >
        {reports
          .filter((report) => report.id !== otherId)
          .map((report) => (
            <option key={report.id} value={report.id}>
              {formatExamDate(report.exam_date)}:{' '}
              {reportBones(report.findings, bones).join(', ') ||
                'No bones listed'}
            </option>
          ))}
      </select>
    </label>
  )
}

function Timeline({ reports }: { reports: SavedReport[] }) {
  const bones = useBones()
  const {
    timelineReportId,
    comparison: chosenPair,
    showReport,
    compareReports,
    stopComparing,
  } = useWorkspace()
  // Starts on the latest report, the one a returning patient has most likely
  // come to see.
  const shownIndex = Math.max(
    reports.findIndex((report) => report.id === timelineReportId),
    timelineReportId === null ? reports.length - 1 : 0,
  )
  const shown = reports[shownIndex]
  const older = reports[shownIndex - 1]
  const newer = reports[shownIndex + 1]
  const comparePartner = older ?? newer

  const comparison = useMemo(
    () =>
      chosenPair &&
      comparedReports(reports, chosenPair.firstId, chosenPair.secondId),
    [reports, chosenPair],
  )
  const markers = useMemo(
    () =>
      comparison
        ? comparisonMarkers(comparison, bones)
        : markersFor(shown.findings, bones),
    [comparison, shown, bones],
  )

  return (
    <div className={styles.layout}>
      <div className={styles.side}>
        <h2>Oldest exam first</h2>
        <ReportHistory
          reports={reports}
          shownId={shown.id}
          comparison={comparison}
        />
      </div>

      <section
        className={styles.shown}
        aria-label={
          comparison && chosenPair
            ? 'Comparing two reports'
            : `Report from ${formatExamDate(shown.exam_date)}`
        }
      >
        {comparison && chosenPair ? (
          <div className={styles.shownHeading}>
            <h2>Comparing</h2>
            <ReportPicker
              label="First report"
              reports={reports}
              chosenId={chosenPair.firstId}
              otherId={chosenPair.secondId}
              onChoose={(id) => compareReports(id, chosenPair.secondId)}
            />
            <ReportPicker
              label="Second report"
              reports={reports}
              chosenId={chosenPair.secondId}
              otherId={chosenPair.firstId}
              onChoose={(id) => compareReports(chosenPair.firstId, id)}
            />
            <button className={styles.open} onClick={stopComparing}>
              Stop comparing
            </button>
          </div>
        ) : (
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
            <button
              disabled={!comparePartner}
              onClick={() => compareReports(comparePartner.id, shown.id)}
            >
              Compare reports
            </button>
            {!comparePartner && (
              <span className={styles.position}>
                Add another report to compare.
              </span>
            )}
            <Link className={styles.open} href={reportPath(shown.id)}>
              Open with the original report
            </Link>
          </div>
        )}
        {/* One skeleton for both reports, so they are always seen from the same
            angle (S5.2). It stays mounted when a comparison starts or stops. */}
        <div className={styles.panes}>
          <SkeletonViewer markers={markers} />
          {comparison ? (
            <ComparisonList comparison={comparison} markers={markers} />
          ) : (
            <FindingsList findings={shown.findings} />
          )}
        </div>
      </section>
    </div>
  )
}

// Recovery Timeline (Plan A.6): reports by exam date, with the model following
// whichever report is shown (S5.1), or both of two reports being compared (S5.2).
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
