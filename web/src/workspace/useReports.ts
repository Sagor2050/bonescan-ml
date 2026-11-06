import { useEffect, useState } from 'react'
import { loadReports, type SavedReport } from './reportStore.ts'

export type ReportsState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; reports: SavedReport[] }

export function useReports() {
  const [state, setState] = useState<ReportsState>({ status: 'loading' })

  useEffect(() => {
    const load = { current: true }
    loadReports().then(
      (reports) => {
        if (load.current) setState({ status: 'ready', reports })
      },
      () => {
        if (load.current) setState({ status: 'failed' })
      },
    )
    return () => {
      load.current = false
    }
  }, [])

  return state
}
