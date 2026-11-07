import {
  lazy,
  Suspense,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import ReportPane from '../report-view/ReportPane.tsx'
import Link from '../routing/Link.tsx'
import { changeReportPath, paths } from '../routing/paths.ts'
import { useBones } from '../viewer/bones.ts'
import { markersFor } from '../viewer/markers.ts'
import DeleteReport from './DeleteReport.tsx'
import { formatExamDate } from './examDate.ts'
import FindingsList from './FindingsList.tsx'
import styles from './ReportScreen.module.css'
import type { SavedFinding, SavedReport } from './reportStore.ts'
import { useReport } from './useReport.ts'

// The 3D code is large, so only this screen loads it.
const SkeletonViewer = lazy(() => import('../viewer/SkeletonViewer.tsx'))

function ReportModel({ findings }: { findings: SavedFinding[] }) {
  const bones = useBones()
  const markers = useMemo(() => markersFor(findings, bones), [findings, bones])
  return <SkeletonViewer markers={markers} />
}

type Tab = 'report' | 'findings'
const TABS: Tab[] = ['report', 'findings']

// The report starts beside the model (S4.1). If the skeleton can't show everything
// the report found, the findings come first, so the reason isn't hidden (S2.4).
function firstTab(findings: SavedFinding[]): Tab {
  const allPlaced =
    findings.length > 0 &&
    findings.every((finding) => finding.status === 'placed')
  return allPlaced ? 'report' : 'findings'
}

// The panel beside the model holds the report or the findings, and the model takes
// the rest of the width (Plan A.5). Both stay mounted, so the place in the report
// isn't lost when switching.
function ReportWorkspace({ report }: { report: SavedReport }) {
  const [tab, setTab] = useState<Tab>(() => firstTab(report.findings))
  const buttons = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({})
  const labels: Record<Tab, string> = {
    report: 'Your original report',
    findings: `Findings (${report.findings.length})`,
  }

  function handleKey(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const next = tab === 'report' ? 'findings' : 'report'
    setTab(next)
    buttons.current[next]?.focus()
  }

  return (
    <div className={tab === 'report' ? styles.withReport : styles.withFindings}>
      <div className={styles.panel}>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Beside the skeleton"
          onKeyDown={handleKey}
        >
          {TABS.map((name) => (
            <button
              key={name}
              ref={(button) => {
                buttons.current[name] = button
              }}
              type="button"
              role="tab"
              id={`tab-${name}`}
              className={styles.tab}
              aria-selected={tab === name}
              aria-controls={`panel-${name}`}
              tabIndex={tab === name ? 0 : -1}
              onClick={() => setTab(name)}
            >
              {labels[name]}
            </button>
          ))}
        </div>
        <div
          id="panel-report"
          className={styles.tabPanel}
          role="tabpanel"
          aria-labelledby="tab-report"
          hidden={tab !== 'report'}
        >
          <ReportPane report={report} visible={tab === 'report'} />
        </div>
        <div
          id="panel-findings"
          className={styles.tabPanel}
          role="tabpanel"
          aria-labelledby="tab-findings"
          hidden={tab !== 'findings'}
        >
          <FindingsList findings={report.findings} showHeading={false} />
        </div>
      </div>
      <ReportModel findings={report.findings} />
    </div>
  )
}

// The original report, the model, and the findings for one report (Plan A.5).
function ReportScreen({ reportId }: { reportId: string }) {
  const report = useReport(reportId)

  return (
    <main className={styles.screen}>
      <div className={styles.heading}>
        <div className={styles.title}>
          <Link className={styles.back} href={paths.reports}>
            ← My reports
          </Link>
          <div className={styles.titleLine}>
            <h1>Your report and skeleton</h1>
            {report.status === 'ready' && (
              <p className={styles.examDate}>
                Exam date: {formatExamDate(report.report.exam_date)}
              </p>
            )}
          </div>
        </div>
        {report.status === 'ready' && (
          <div className={styles.actions}>
            <Link
              className="btn btn-quiet"
              href={changeReportPath(reportId)}
            >
              Change the date or findings
            </Link>
            <DeleteReport report={report.report} />
          </div>
        )}
      </div>
      {report.status === 'loading' && (
        <p className="page-message">Loading your report…</p>
      )}
      {report.status === 'missing' && (
        <p className="page-message">We can't find that report.</p>
      )}
      {report.status === 'failed' && (
        <p className="page-message">
          We couldn't load your report. Please try again.
        </p>
      )}
      {report.status === 'ready' && (
        <Suspense
          fallback={<p className="page-message">Loading the skeleton…</p>}
        >
          <ReportWorkspace key={reportId} report={report.report} />
        </Suspense>
      )}
    </main>
  )
}

export default ReportScreen
