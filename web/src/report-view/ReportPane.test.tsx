import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { SavedReport } from '../workspace/reportStore.ts'
import WorkspaceController from '../workspace/WorkspaceController.tsx'
import { useWorkspace } from '../workspace/workspaceState.ts'
import ReportPane from './ReportPane.tsx'

const pasted: SavedReport = {
  id: 'report-1',
  source: 'pasted',
  file_path: '',
  raw_text: 'EXAM: XR WRIST LEFT\n\n  FINDINGS: Fictional text.',
  exam_date: '2026-09-14',
  exam_date_source: 'report',
  added_at: '2026-09-15T12:00:00Z',
  findings: [],
}

const finding = (id: string, fields = {}) => ({
  id,
  report_id: pasted.id,
  position: 0,
  bone: 'radius',
  side: 'left' as const,
  part: [],
  type_words: [],
  certainty: 'certain' as const,
  healing_words: [],
  status: 'placed' as const,
  wording: [],
  entered_by_patient: false,
  ...fields,
})

function SelectButton({ findingId }: { findingId: string }) {
  const { selectFinding, selectedFindingId } = useWorkspace()
  return (
    <button onClick={() => selectFinding(findingId)}>
      Selected: {selectedFindingId ?? 'nothing'}
    </button>
  )
}

function renderPane(report: SavedReport, findingId = 'a') {
  return render(
    <WorkspaceController>
      <SelectButton findingId={findingId} />
      <ReportPane report={report} />
    </WorkspaceController>,
  )
}

const withWording: SavedReport = {
  ...pasted,
  findings: [
    finding('a', {
      wording: [{ start: 0, end: 4, text: 'EXAM' }],
    }),
  ],
}

test('wording that produced a finding is marked, and the text stays exact', () => {
  renderPane(withWording)
  const mark = screen.getByRole('button', { name: 'EXAM' })
  expect(mark.dataset.finding).toBe('a')
  const pane = screen.getByRole('region', { name: 'Your original report' })
  expect(pane.querySelector('pre')?.textContent).toBe(pasted.raw_text)
})

test('selecting the wording selects its finding', () => {
  renderPane(withWording)
  fireEvent.click(screen.getByRole('button', { name: 'EXAM' }))
  expect(screen.getByText('Selected: a')).toBeDefined()
  expect(
    screen.getByRole('button', { name: 'EXAM' }).getAttribute('aria-pressed'),
  ).toBe('true')
})

test('the wording works from the keyboard', () => {
  renderPane(withWording)
  fireEvent.keyDown(screen.getByRole('button', { name: 'EXAM' }), {
    key: 'Enter',
  })
  expect(screen.getByText('Selected: a')).toBeDefined()
})

test('a finding the patient entered says it has no wording', () => {
  renderPane({
    ...pasted,
    findings: [finding('a', { entered_by_patient: true })],
  })
  expect(screen.queryByText(/Entered by you/)).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: /Selected/ }))

  expect(
    screen.getByText('Entered by you. This finding has no wording in the report.'),
  ).toBeDefined()
})

test('the app’s note stays outside the report', () => {
  renderPane({
    ...pasted,
    findings: [finding('a', { entered_by_patient: true })],
  })
  fireEvent.click(screen.getByRole('button', { name: /Selected/ }))
  expect(screen.getByText(/Entered by you/).closest('pre')).toBeNull()
})

test('shows pasted text exactly as added, with its spaces and line breaks', () => {
  renderPane(pasted)
  const pane = screen.getByRole('region', { name: 'Your original report' })
  expect(pane.querySelector('pre')?.textContent).toBe(pasted.raw_text)
})

test('keeps the app’s own words outside the report', () => {
  renderPane(pasted)
  const note = screen.getByText(/Ask your care team/)
  expect(note.closest('pre')).toBeNull()
})
