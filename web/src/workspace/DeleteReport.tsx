import { useRef, useState, type KeyboardEvent } from 'react'
import { paths } from '../routing/paths.ts'
import { navigate } from '../routing/router.ts'
import styles from './DeleteReport.module.css'
import { deleteReport, isSample, type SavedReport } from './reportStore.ts'
import { useWorkspace } from './workspaceState.ts'

type Step = 'closed' | 'kept' | 'asking' | 'deleting' | 'failed'

// Asks first, because a deleted report can't be recovered (S1.3). The question
// opens over the screen, so nothing behind it moves.
function DeleteReport({ report }: { report: SavedReport }) {
  const { forgetReport } = useWorkspace()
  const [step, setStep] = useState<Step>('closed')
  const dialog = useRef<HTMLDivElement>(null)
  const open = step !== 'closed' && step !== 'kept'

  // The fictional samples in development aren't saved anywhere.
  if (isSample(report.id)) return null

  if (!open) {
    return (
      <button
        className="btn-danger-quiet"
        autoFocus={step === 'kept'}
        onClick={() => setStep('asking')}
      >
        Delete this report
      </button>
    )
  }

  async function confirm() {
    setStep('deleting')
    try {
      await deleteReport(report)
    } catch {
      setStep('failed')
      return
    }
    forgetReport(report.id)
    navigate(paths.reports)
  }

  const deleting = step === 'deleting'

  // Keeps the keyboard inside the question while it's open.
  function handleKey(event: KeyboardEvent) {
    if (event.key === 'Escape' && !deleting) {
      setStep('kept')
      return
    }
    if (event.key !== 'Tab') return
    const buttons = dialog.current?.querySelectorAll('button')
    if (!buttons?.length) return
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className={styles.backdrop}>
      <div
        ref={dialog}
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-label="Delete this report"
        aria-describedby="delete-report-details"
        onKeyDown={handleKey}
      >
        <p className={styles.question}>Delete this report?</p>
        <p id="delete-report-details">
          Its findings and original file will be deleted too, and it will leave
          your timeline. You can't get it back.
        </p>
        {step === 'failed' && (
          <p role="alert">We couldn't delete your report. Please try again.</p>
        )}
        <div className={styles.actions}>
          <button autoFocus disabled={deleting} onClick={() => setStep('kept')}>
            Keep the report
          </button>
          <button className="btn-danger" disabled={deleting} onClick={confirm}>
            {deleting ? 'Deleting…' : 'Yes, delete it'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteReport
