import { lazy, Suspense } from 'react'
import type { SavedReport } from '../workspace/reportStore.ts'
import styles from './ReportPane.module.css'

// PDF.js is large, and pasted reports don't need it.
const PdfReport = lazy(() => import('./PdfReport.tsx'))

// The original report, exactly as added (NFR4). The app's own words stay in the
// heading above it, outside the page.
function ReportPane({ report }: { report: SavedReport }) {
  return (
    <section className={styles.pane} aria-label="Your original report">
      <h2>Your original report</h2>
      <div className={styles.page} tabIndex={0}>
        {report.source === 'pdf' ? (
          <Suspense fallback={<p>Loading your report…</p>}>
            <PdfReport report={report} />
          </Suspense>
        ) : (
          <pre className={styles.pasted}>{report.raw_text}</pre>
        )}
      </div>
    </section>
  )
}

export default ReportPane
