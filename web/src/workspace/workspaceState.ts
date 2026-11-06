import { createContext, useContext } from 'react'

// The Workspace Controller's state (Plan section 3). The report pane and the
// skeleton both follow the one selected finding here, so they can't disagree.
// The confirmation gate joins it in Milestone 4, and the timeline and comparison
// state in Milestone 6.
export type WorkspaceState = {
  selectedFindingId: string | null
  // Goes up with every selection, even of the same finding, so that choosing a
  // finding again brings the camera back to it.
  selectionCount: number
  // The report the timeline is showing. Null until the patient chooses one.
  timelineReportId: string | null
}

export type WorkspaceAction =
  | { type: 'selectFinding'; findingId: string }
  | { type: 'clearSelection' }
  | { type: 'showReport'; reportId: string }
  | { type: 'forgetReport'; reportId: string }

export const initialWorkspaceState: WorkspaceState = {
  selectedFindingId: null,
  selectionCount: 0,
  timelineReportId: null,
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  switch (action.type) {
    case 'selectFinding':
      return {
        ...state,
        selectedFindingId: action.findingId,
        selectionCount: state.selectionCount + 1,
      }
    case 'clearSelection':
      return { ...state, selectedFindingId: null }
    case 'showReport':
      // A finding belongs to one report, so its selection doesn't carry over.
      return {
        ...state,
        timelineReportId: action.reportId,
        selectedFindingId: null,
      }
    case 'forgetReport':
      // A deleted report's findings are gone, and the timeline goes back to
      // starting on the latest report.
      return {
        ...state,
        timelineReportId:
          state.timelineReportId === action.reportId
            ? null
            : state.timelineReportId,
        selectedFindingId: null,
      }
  }
}

// The finding one step before or after the current one, or null at either end.
// With nothing selected, stepping starts at the first finding.
export function steppedFinding(
  findingIds: string[],
  current: string | null,
  step: 1 | -1,
) {
  const index = current === null ? -1 : findingIds.indexOf(current)
  if (index === -1) return step === 1 ? (findingIds[0] ?? null) : null
  return findingIds[index + step] ?? null
}

export type Workspace = WorkspaceState & {
  selectFinding: (findingId: string) => void
  clearSelection: () => void
  showReport: (reportId: string) => void
  forgetReport: (reportId: string) => void
}

export const WorkspaceContext = createContext<Workspace | null>(null)

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext)
  if (!workspace) {
    throw new Error('useWorkspace must be used inside WorkspaceController')
  }
  return workspace
}
