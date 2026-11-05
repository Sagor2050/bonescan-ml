import { createContext, useContext } from 'react'

// The Workspace Controller's state (Plan section 3). The report pane and the
// skeleton both follow the one selected finding here, so they can't disagree.
// The confirmation gate joins it in Milestone 4, and the timeline and comparison
// state in Milestone 6.
export type WorkspaceState = {
  selectedFindingId: string | null
}

export type WorkspaceAction =
  | { type: 'selectFinding'; findingId: string }
  | { type: 'clearSelection' }

export const initialWorkspaceState: WorkspaceState = {
  selectedFindingId: null,
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction,
): WorkspaceState {
  switch (action.type) {
    case 'selectFinding':
      return { ...state, selectedFindingId: action.findingId }
    case 'clearSelection':
      return { ...state, selectedFindingId: null }
  }
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
