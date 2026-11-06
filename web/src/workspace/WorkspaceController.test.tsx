import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import WorkspaceController from './WorkspaceController.tsx'
import {
  initialWorkspaceState,
  steppedFinding,
  useWorkspace,
  workspaceReducer,
} from './workspaceState.ts'

// Stand-ins for the two panes that follow the selected finding (S4.2).
function Pane({ name, findingId }: { name: string; findingId: string }) {
  const { selectedFindingId, selectFinding, clearSelection } = useWorkspace()
  return (
    <section aria-label={name}>
      <p>Selected: {selectedFindingId ?? 'nothing'}</p>
      <button onClick={() => selectFinding(findingId)}>Select</button>
      <button onClick={clearSelection}>Clear</button>
    </section>
  )
}

function renderPanes() {
  render(
    <WorkspaceController>
      <Pane name="report" findingId="finding-1" />
      <Pane name="skeleton" findingId="finding-2" />
    </WorkspaceController>,
  )
}

function pane(name: string) {
  return screen.getByRole('region', { name })
}

function click(paneName: string, button: string) {
  fireEvent.click(within(pane(paneName)).getByRole('button', { name: button }))
}

test('nothing is selected at first', () => {
  renderPanes()
  expect(pane('report').textContent).toContain('Selected: nothing')
  expect(pane('skeleton').textContent).toContain('Selected: nothing')
})

test('selecting a finding in one pane updates both panes', () => {
  renderPanes()

  click('report', 'Select')

  expect(pane('report').textContent).toContain('Selected: finding-1')
  expect(pane('skeleton').textContent).toContain('Selected: finding-1')
})

test('only one finding is selected at a time', () => {
  renderPanes()

  click('report', 'Select')
  click('skeleton', 'Select')

  expect(pane('report').textContent).toContain('Selected: finding-2')
  expect(pane('skeleton').textContent).toContain('Selected: finding-2')
})

test('clearing the selection clears it in both panes', () => {
  renderPanes()
  click('report', 'Select')

  click('skeleton', 'Clear')

  expect(pane('report').textContent).toContain('Selected: nothing')
  expect(pane('skeleton').textContent).toContain('Selected: nothing')
})

test('the reducer selects and clears a finding', () => {
  const selected = workspaceReducer(initialWorkspaceState, {
    type: 'selectFinding',
    findingId: 'finding-1',
  })
  expect(selected.selectedFindingId).toBe('finding-1')

  const cleared = workspaceReducer(selected, { type: 'clearSelection' })
  expect(cleared.selectedFindingId).toBeNull()
})

test('showing another report clears the selected finding', () => {
  const selected = workspaceReducer(initialWorkspaceState, {
    type: 'selectFinding',
    findingId: 'finding-1',
  })
  const next = workspaceReducer(selected, {
    type: 'showReport',
    reportId: 'report-2',
  })
  expect(next.timelineReportId).toBe('report-2')
  expect(next.selectedFindingId).toBeNull()
})

test('comparing clears the selection, and showing one report stops comparing', () => {
  const selected = workspaceReducer(initialWorkspaceState, {
    type: 'selectFinding',
    findingId: 'finding-1',
  })
  const comparing = workspaceReducer(selected, {
    type: 'compareReports',
    firstId: 'a',
    secondId: 'b',
  })
  expect(comparing.comparison).toEqual({ firstId: 'a', secondId: 'b' })
  expect(comparing.selectedFindingId).toBeNull()

  expect(
    workspaceReducer(comparing, { type: 'showReport', reportId: 'a' }).comparison,
  ).toBeNull()
  expect(workspaceReducer(comparing, { type: 'stopComparing' }).comparison).toBeNull()
})

test('deleting a report being compared ends the comparison', () => {
  const comparing = workspaceReducer(initialWorkspaceState, {
    type: 'compareReports',
    firstId: 'a',
    secondId: 'b',
  })
  expect(
    workspaceReducer(comparing, { type: 'forgetReport', reportId: 'c' }).comparison,
  ).toEqual({ firstId: 'a', secondId: 'b' })
  expect(
    workspaceReducer(comparing, { type: 'forgetReport', reportId: 'b' }).comparison,
  ).toBeNull()
})

test('selecting the same finding again still counts as a new selection', () => {
  const first = workspaceReducer(initialWorkspaceState, {
    type: 'selectFinding',
    findingId: 'finding-1',
  })
  const again = workspaceReducer(first, {
    type: 'selectFinding',
    findingId: 'finding-1',
  })
  expect(again.selectionCount).toBe(first.selectionCount + 1)
})

test.each([
  [null, 1, 'a'],
  [null, -1, null],
  ['a', 1, 'b'],
  ['b', 1, 'c'],
  ['c', 1, null],
  ['b', -1, 'a'],
  ['a', -1, null],
  ['not-in-this-report', 1, 'a'],
] as const)('stepping from %s by %i gives %s', (current, step, expected) => {
  expect(steppedFinding(['a', 'b', 'c'], current, step)).toBe(expected)
})

test('stepping through no findings gives nothing', () => {
  expect(steppedFinding([], null, 1)).toBeNull()
})

test('useWorkspace outside the controller is an error', () => {
  function Orphan() {
    useWorkspace()
    return null
  }
  // React logs the thrown error; keep it out of the test output.
  const consoleError = console.error
  console.error = () => {}
  try {
    expect(() => render(<Orphan />)).toThrow(/inside WorkspaceController/)
  } finally {
    console.error = consoleError
  }
})

test('forgetting the report the timeline shows starts it on the latest again', () => {
  const state = {
    ...initialWorkspaceState,
    timelineReportId: 'report-1',
    selectedFindingId: 'finding-1',
  }

  expect(
    workspaceReducer(state, { type: 'forgetReport', reportId: 'report-1' }),
  ).toMatchObject({ timelineReportId: null, selectedFindingId: null })
})

test('forgetting another report leaves the timeline where it is', () => {
  const state = { ...initialWorkspaceState, timelineReportId: 'report-2' }

  expect(
    workspaceReducer(state, { type: 'forgetReport', reportId: 'report-1' })
      .timelineReportId,
  ).toBe('report-2')
})
