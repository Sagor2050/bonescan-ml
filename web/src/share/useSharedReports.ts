import { useEffect, useState } from 'react'
import { loadSharedReports, type SharedReportsResult } from './sharedReports.ts'

export type SharedReportsState =
  | { status: 'loading' }
  | { status: 'failed' }
  | SharedReportsResult

export function useSharedReports(token: string) {
  const [loaded, setLoaded] = useState<{
    token: string
    state: SharedReportsState
  } | null>(null)

  useEffect(() => {
    let current = true
    loadSharedReports(token).then(
      (result) => {
        if (current) setLoaded({ token, state: result })
      },
      () => {
        if (current) setLoaded({ token, state: { status: 'failed' } })
      },
    )
    return () => {
      current = false
    }
  }, [token])

  const state: SharedReportsState =
    loaded?.token === token ? loaded.state : { status: 'loading' }
  return state
}
