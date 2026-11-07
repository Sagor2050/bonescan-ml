import { lazy, Suspense, useEffect, useRef } from 'react'
import type { SavedReport } from '../workspace/reportStore.ts'
import { useWorkspace } from '../workspace/workspaceState.ts'
import PastedReport from './PastedReport.tsx'
import styles from './ReportPane.module.css'

// PDF.js is large, and pasted reports don't need it.
const PdfReport = lazy(() => import('./PdfReport.tsx'))

function isInView(element: Element, container: Element) {
  const box = element.getBoundingClientRect()
  const view = container.getBoundingClientRect()
  return box.top >= view.top && box.bottom <= view.bottom
}

// The original report, exactly as added (NFR4). The app's own words stay outside
// the page, and highlights are drawn on top of it.
function ReportPane({
  report,
  visible = true,
}: {
  report: SavedReport
  // Whether the pane is showing. Wording can't be scrolled to while it's hidden.
  visible?: boolean
}) {
  const { selectedFindingId, selectionCount } = useWorkspace()
  const pageRef = useRef<HTMLDivElement>(null)

  const selected = report.findings.find(
    (finding) => finding.id === selectedFindingId,
  )
  const enteredWithNoWording =
    selected?.entered_by_patient && selected.wording.length === 0

  // Selecting a finding brings its wording into view (S4.2), unless some of it
  // is already showing. So clicking the Impression doesn't jump to the Findings.
  useEffect(() => {
    const page = pageRef.current
    if (!page || !selectedFindingId || !visible) return
    const pieces = Array.from(
      page.querySelectorAll(`[data-finding="${CSS.escape(selectedFindingId)}"]`),
    )
    if (pieces.length === 0 || pieces.some((piece) => isInView(piece, page))) {
      return
    }
    pieces[0].scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [selectedFindingId, selectionCount, visible])

  return (
    <section className={styles.pane} aria-label="Your original report">
      {enteredWithNoWording && (
        <p className={styles.note}>
          Entered by you. This finding has no wording in the report.
        </p>
      )}
      <div ref={pageRef} className={styles.page} tabIndex={0}>
        {report.source === 'pdf' ? (
          <Suspense fallback={<p>Loading your report…</p>}>
            <PdfReport report={report} />
          </Suspense>
        ) : (
          <PastedReport report={report} />
        )}
      </div>
      <p className={styles.careTeam}>
        Questions about what this means? Ask your care team.
      </p>
    </section>
  )
}

export default ReportPane
