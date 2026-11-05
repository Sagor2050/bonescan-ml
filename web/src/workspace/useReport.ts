import { useEffect, useState } from 'react'
import { loadReport, type SavedReport } from './reportStore.ts'

export type ReportState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'failed' }
  | { status: 'ready'; report: SavedReport }

export function useReport(reportId: string) {
  const [loaded, setLoaded] = useState<{
    reportId: string
    state: ReportState
  } | null>(null)

  useEffect(() => {
    let current = true
    loadReport(reportId).then(
      (report) => {
        if (!current) return
        setLoaded({
          reportId,
          state: report
            ? { status: 'ready', report }
            : { status: 'missing' },
        })
      },
      () => {
        if (current) setLoaded({ reportId, state: { status: 'failed' } })
      },
    )
    return () => {
      current = false
    }
  }, [reportId])

  const state: ReportState =
    loaded?.reportId === reportId ? loaded.state : { status: 'loading' }
  return state
}
