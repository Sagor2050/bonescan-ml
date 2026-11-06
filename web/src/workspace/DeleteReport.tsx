import { useState } from 'react'
import { paths } from '../routing/paths.ts'
import { navigate } from '../routing/router.ts'
import styles from './DeleteReport.module.css'
import { deleteReport, isSample, type SavedReport } from './reportStore.ts'
import { useWorkspace } from './workspaceState.ts'

type Step = 'closed' | 'kept' | 'asking' | 'deleting' | 'failed'

// Asks first, because a deleted report can't be recovered (S1.3).
function DeleteReport({ report }: { report: SavedReport }) {
  const { forgetReport } = useWorkspace()
  const [step, setStep] = useState<Step>('closed')

  // The fictional samples in development aren't saved anywhere.
  if (isSample(report.id)) return null

  if (step === 'closed' || step === 'kept') {
    return (
      <button autoFocus={step === 'kept'} onClick={() => setStep('asking')}>
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
  return (
    <section className={styles.confirm} aria-label="Delete this report">
      <p>
        <strong>Delete this report?</strong> Its findings and original file will
        be deleted too, and it will leave your timeline. You can't get it back.
      </p>
      {step === 'failed' && (
        <p role="alert">We couldn't delete your report. Please try again.</p>
      )}
      <div className={styles.actions}>
        <button autoFocus disabled={deleting} onClick={() => setStep('kept')}>
          Keep the report
        </button>
        <button disabled={deleting} onClick={confirm}>
          {deleting ? 'Deleting…' : 'Yes, delete it'}
        </button>
      </div>
    </section>
  )
}

export default DeleteReport
