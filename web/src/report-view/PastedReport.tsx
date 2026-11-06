import type { KeyboardEvent } from 'react'
import type { SavedReport } from '../workspace/reportStore.ts'
import { useWorkspace } from '../workspace/workspaceState.ts'
import { textSegments } from './highlights.ts'
import styles from './ReportPane.module.css'

// Pasted text as written, with the wording that produced a finding marked. A
// button can't wrap across lines, so the marks are made to act like buttons.
function PastedReport({ report }: { report: SavedReport }) {
  const { selectedFindingId, selectFinding } = useWorkspace()

  function handleKey(event: KeyboardEvent, findingId: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectFinding(findingId)
    }
  }

  return (
    <pre className={styles.pasted}>
      {textSegments(report.raw_text, report.findings).map((segment, index) =>
        segment.findingId ? (
          <mark
            key={index}
            className={styles.wording}
            data-finding={segment.findingId}
            role="button"
            tabIndex={0}
            aria-pressed={segment.findingId === selectedFindingId}
            onClick={() => selectFinding(segment.findingId as string)}
            onKeyDown={(event) =>
              handleKey(event, segment.findingId as string)
            }
          >
            {segment.text}
          </mark>
        ) : (
          segment.text
        ),
      )}
    </pre>
  )
}

export default PastedReport
