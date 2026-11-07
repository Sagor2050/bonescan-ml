import { lazy, Suspense, useMemo, useState } from 'react'
import ReportPane from '../report-view/ReportPane.tsx'
import Link from '../routing/Link.tsx'
import { changeReportPath, paths } from '../routing/paths.ts'
import { useBones } from '../viewer/bones.ts'
import { markersFor } from '../viewer/markers.ts'
import DeleteReport from './DeleteReport.tsx'
import { formatExamDate } from './examDate.ts'
import FindingsList from './FindingsList.tsx'
import styles from './ReportScreen.module.css'
import type { SavedFinding } from './reportStore.ts'
import { useReport } from './useReport.ts'

// The 3D code is large, so only this screen loads it.
const SkeletonViewer = lazy(() => import('../viewer/SkeletonViewer.tsx'))

function ReportModel({ findings }: { findings: SavedFinding[] }) {
  const bones = useBones()
  const markers = useMemo(() => markersFor(findings, bones), [findings, bones])
  return <SkeletonViewer markers={markers} />
}

// The split view (Plan A.5): the original report, the model, and the findings.
function ReportScreen({ reportId }: { reportId: string }) {
  const report = useReport(reportId)
  const [showReport, setShowReport] = useState(true)

  return (
    <main className={styles.screen}>
      <div className={styles.heading}>
        <div>
          <Link className={styles.back} href={paths.reports}>
            ← My reports
          </Link>
          <h1>Your report and skeleton</h1>
        </div>
        {report.status === 'ready' && (
          <p className={styles.examDate}>
            Exam date: {formatExamDate(report.report.exam_date)}
          </p>
        )}
        {report.status === 'ready' && (
          <button
            onClick={() => setShowReport(!showReport)}
          >
            {showReport ? 'Hide the report' : 'Show the report'}
          </button>
        )}
        {report.status === 'ready' && (
          <Link className={styles.change} href={changeReportPath(reportId)}>
            Change the date or findings
          </Link>
        )}
        {report.status === 'ready' && <DeleteReport report={report.report} />}
      </div>
      {report.status === 'loading' && <p>Loading your report…</p>}
      {report.status === 'missing' && <p>We can't find that report.</p>}
      {report.status === 'failed' && (
        <p>We couldn't load your report. Please try again.</p>
      )}
      {report.status === 'ready' && (
        <Suspense fallback={<p>Loading the skeleton…</p>}>
          <div className={showReport ? styles.split : styles.modelOnly}>
            {/* Kept while hidden, so the place in the report isn't lost. */}
            <div className={styles.reportPane} hidden={!showReport}>
              <ReportPane report={report.report} />
            </div>
            <ReportModel findings={report.report.findings} />
            <FindingsList findings={report.report.findings} />
          </div>
        </Suspense>
      )}
    </main>
  )
}

export default ReportScreen
