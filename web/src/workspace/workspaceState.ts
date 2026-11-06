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
}

export type WorkspaceAction =
  | { type: 'selectFinding'; findingId: string }
  | { type: 'clearSelection' }

export const initialWorkspaceState: WorkspaceState = {
  selectedFindingId: null,
  selectionCount: 0,
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
}

export const WorkspaceContext = createContext<Workspace | null>(null)

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext)
  if (!workspace) {
    throw new Error('useWorkspace must be used inside WorkspaceController')
  }
  return workspace
}
