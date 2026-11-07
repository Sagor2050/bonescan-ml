import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import bones from '../../public/shared/bones.json'
import ChangeReportScreen from './ChangeReportScreen.tsx'
import { loadReport, saveReportChanges, type SavedReport } from './reportStore.ts'
import WorkspaceController from './WorkspaceController.tsx'

vi.mock('./reportStore.ts', async (original) => ({
  ...(await original<typeof import('./reportStore.ts')>()),
  loadReport: vi.fn(),
  saveReportChanges: vi.fn(async () => undefined),
}))

const report: SavedReport = {
  id: 'report-1',
  source: 'pasted',
  file_path: '',
  raw_text: 'The original report.',
  exam_date: '2026-09-14',
  exam_date_source: 'report',
  added_at: '2026-09-15T12:00:00Z',
  findings: [
    {
      id: 'finding-1',
      report_id: 'report-1',
      position: 0,
      bone: 'radius',
      side: 'left',
      part: ['distal'],
      type_words: [],
      certainty: 'certain',
      healing_words: [],
      status: 'placed',
      wording: [{ start: 0, end: 21, text: 'Fracture of the radius' }],
      entered_by_patient: false,
    },
  ],
}

async function open() {
  await act(async () => {
    render(
      <WorkspaceController>
        <ChangeReportScreen reportId="report-1" />
      </WorkspaceController>,
    )
  })
}

const dateInput = () => screen.getByLabelText('Exam date')
const saveButton = () => screen.getByRole('button', { name: 'Save my changes' })

beforeEach(() => {
  vi.mocked(loadReport).mockReset().mockResolvedValue(report)
  vi.mocked(saveReportChanges).mockClear()
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(bones) }),
    ),
  )
})

test('starts with the report’s date and findings, and its words', async () => {
  await open()
  expect((dateInput() as HTMLInputElement).value).toBe('2026-09-14')
  expect(screen.getByText('Fracture of the radius')).toBeTruthy()
})

test('says the original report doesn’t change', async () => {
  await open()
  expect(screen.getByText(/doesn't change your original report/)).toBeTruthy()
})

test('saves a new date', async () => {
  await open()
  fireEvent.change(dateInput(), { target: { value: '2026-10-01' } })
  await act(async () => {
    fireEvent.click(saveButton())
  })
  expect(saveReportChanges).toHaveBeenCalledWith(
    report,
    expect.objectContaining({ examDate: '2026-10-01' }),
  )
})

test.each([
  ['2999-01-01', /can't be in the future/],
  ['', /Enter the date/],
])('refuses the date “%s”', async (value, message) => {
  await open()
  fireEvent.change(dateInput(), { target: { value } })
  expect(screen.getByRole('alert').textContent).toMatch(message)
  expect((saveButton() as HTMLButtonElement).disabled).toBe(true)
})

test('a correction is labeled as entered by the patient', async () => {
  await open()
  const card = within(screen.getByRole('listitem', { name: 'Finding 1' }))
  expect(card.queryByText('Entered by you')).toBeNull()
  fireEvent.change(card.getByLabelText('Side for finding 1'), {
    target: { value: 'right' },
  })
  expect(card.getByText('Entered by you')).toBeTruthy()

  await act(async () => {
    fireEvent.click(saveButton())
  })
  const [, changes] = vi.mocked(saveReportChanges).mock.calls[0]
  expect(changes.findings[0]).toMatchObject({
    key: 'finding-1',
    side: 'right',
    entered_by_patient: true,
  })
})

test('removing every finding says so, without claiming none were found', async () => {
  await open()
  fireEvent.click(screen.getByRole('button', { name: 'Remove finding 1' }))
  expect(screen.getByText(/has no findings listed/)).toBeTruthy()
  expect(screen.queryByText(/didn't find any fractures/)).toBeNull()
})

test('stays on the screen and says so when saving fails', async () => {
  vi.mocked(saveReportChanges).mockRejectedValueOnce(
    new Error('Your changes could not all be saved.'),
  )
  await open()
  await act(async () => {
    fireEvent.click(saveButton())
  })
  expect(screen.getByRole('alert').textContent).toMatch(/could not all be saved/)
  expect((saveButton() as HTMLButtonElement).disabled).toBe(false)
})

test('a report that can’t be found says so', async () => {
  vi.mocked(loadReport).mockResolvedValue(null)
  await open()
  expect(screen.getByText("We can't find that report.")).toBeTruthy()
})
