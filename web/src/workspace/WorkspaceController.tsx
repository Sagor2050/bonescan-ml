import { useMemo, useReducer, type ReactNode } from 'react'
import {
  initialWorkspaceState,
  WorkspaceContext,
  workspaceReducer,
} from './workspaceState.ts'

function WorkspaceController({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState)

  const workspace = useMemo(
    () => ({
      ...state,
      selectFinding: (findingId: string) =>
        dispatch({ type: 'selectFinding', findingId }),
      clearSelection: () => dispatch({ type: 'clearSelection' }),
      showReport: (reportId: string) =>
        dispatch({ type: 'showReport', reportId }),
      forgetReport: (reportId: string) =>
        dispatch({ type: 'forgetReport', reportId }),
      compareReports: (firstId: string, secondId: string) =>
        dispatch({ type: 'compareReports', firstId, secondId }),
      stopComparing: () => dispatch({ type: 'stopComparing' }),
    }),
    [state],
  )

  return (
    <WorkspaceContext.Provider value={workspace}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export default WorkspaceController
