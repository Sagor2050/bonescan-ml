import { lazy, Suspense } from 'react'
import styles from './ReportScreen.module.css'
import { useReport } from './useReport.ts'

// The 3D code is large, so only this screen loads it.
const SkeletonViewer = lazy(() => import('../viewer/SkeletonViewer.tsx'))

// The split view (Plan A.5). For now it has the model half.
function ReportScreen({ reportId }: { reportId: string }) {
  const report = useReport(reportId)

  return (
    <main className={styles.screen}>
      <h1>Your report and skeleton</h1>
      {report.status === 'loading' && <p>Loading your report…</p>}
      {report.status === 'missing' && <p>We can't find that report.</p>}
      {report.status === 'failed' && (
        <p>We couldn't load your report. Please try again.</p>
      )}
      {report.status === 'ready' && (
        <Suspense fallback={<p>Loading the skeleton…</p>}>
          <SkeletonViewer findings={report.report.findings} />
        </Suspense>
      )}
    </main>
  )
}

export default ReportScreen
