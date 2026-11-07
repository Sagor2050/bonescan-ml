import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import bones from '../../public/shared/bones.json'
import b1 from '../../../tests/fixtures/read-b1-pasted.json'
import { parseReadResponse } from '../findings/parse.ts'
import type { Finding } from '../findings/types.ts'
import { draftFromReader, setDraftReport } from './draftReport.ts'
import { saveReport } from './saveReport.ts'
import VerifyFindingsScreen from './VerifyFindingsScreen.tsx'

vi.mock('./saveReport.ts', () => ({
  saveReport: vi.fn(async () => 'new-report-id'),
}))

const reader = parseReadResponse(b1)
const [radius] = reader.findings

function showDraft(overrides: Partial<typeof reader> = {}) {
  setDraftReport(
    draftFromReader({ ...reader, ...overrides }, { pasted: true }),
  )
}

async function renderScreen() {
  await act(async () => {
    render(<VerifyFindingsScreen />)
  })
  await screen.findByRole('button', { name: 'Add a finding we missed' })
}

function card(number = 1) {
  return within(screen.getByRole('listitem', { name: `Finding ${number}` }))
}

// A finding that already has a marker keeps its form closed until it's asked for.
function openForm(number = 1) {
  fireEvent.click(
    card(number).getByRole('button', { name: `Change finding ${number}` }),
  )
}

function confirmButton() {
  return screen.getByRole('button', { name: 'Confirm and see the skeleton' })
}

function withFinding(change: Partial<Finding>) {
  return { findings: [{ ...radius, ...change }] }
}

beforeEach(() => {
  setDraftReport(null)
  vi.mocked(saveReport).mockClear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(bones))),
  )
  window.history.replaceState(null, '', '/verify-findings')
})

test('with no report, it says so and links to adding one', () => {
  render(<VerifyFindingsScreen />)
  expect(screen.getByText("There's no report to check right now.")).toBeDefined()
  expect(screen.getByRole('link', { name: 'Add a report' })).toBeDefined()
})

test('shows every finding with the report wording it came from', async () => {
  showDraft()
  await renderScreen()
  expect(card().getByRole('heading').textContent).toContain(
    'radius (forearm bone, thumb side), left side',
  )
  expect(
    card().getByText('Mildly angulated distal left radius fracture.'),
  ).toBeDefined()
  expect(card().getByText('Will be marked on the skeleton')).toBeDefined()
  expect(card().queryByText('Entered by you')).toBeNull()
})

test('nothing is saved until the patient confirms', async () => {
  showDraft()
  await renderScreen()
  expect(saveReport).not.toHaveBeenCalled()

  fireEvent.click(confirmButton())

  await waitFor(() => expect(saveReport).toHaveBeenCalledTimes(1))
  expect(window.location.pathname).toBe('/reports/new-report-id')
})

test('a finding can be removed', async () => {
  showDraft()
  await renderScreen()
  fireEvent.click(card().getByRole('button', { name: 'Remove finding 1' }))
  expect(screen.queryByRole('listitem', { name: 'Finding 1' })).toBeNull()
})

test('a finding that has a marker keeps its form closed, and still says what was read', async () => {
  showDraft()
  await renderScreen()
  expect(card().queryByLabelText('Side for finding 1')).toBeNull()
  expect(card().getByText('Part: distal, metaphysis')).toBeDefined()
  openForm()
  expect(card().getByLabelText('Side for finding 1')).toBeDefined()
  fireEvent.click(card().getByRole('button', { name: 'Done changing finding 1' }))
  expect(card().queryByLabelText('Side for finding 1')).toBeNull()
})

test('a finding with no part says it means the whole bone', async () => {
  showDraft(withFinding({ part: [] }))
  await renderScreen()
  expect(card().getByText('Part: the whole bone')).toBeDefined()
})

test('changing the side labels the finding as entered by the patient', async () => {
  showDraft()
  await renderScreen()
  openForm()
  fireEvent.change(card().getByLabelText('Side for finding 1'), {
    target: { value: 'right' },
  })
  expect(card().getByText('Entered by you')).toBeDefined()
  expect(card().getByRole('heading').textContent).toContain('right side')
  expect(
    card().getByText('Mildly angulated distal left radius fracture.'),
  ).toBeDefined()
})

test('changing the bone keeps only the parts that bone has', async () => {
  showDraft()
  await renderScreen()
  openForm()
  fireEvent.change(card().getByLabelText('Bone for finding 1'), {
    target: { value: 'scaphoid' },
  })
  expect(card().getByLabelText('distal')).toHaveProperty('checked', true)
  expect(card().queryByLabelText('metaphysis')).toBeNull()
  expect(card().getByLabelText('waist')).toHaveProperty('checked', false)
})

test('a part can be chosen', async () => {
  showDraft()
  await renderScreen()
  openForm()
  fireEvent.click(card().getByLabelText('shaft'))
  expect(card().getByLabelText('shaft')).toHaveProperty('checked', true)
  expect(card().getByText('Entered by you')).toBeDefined()
})

test('a missed finding can be added, and is marked once it has a bone and side', async () => {
  showDraft({ findings: [] })
  await renderScreen()
  fireEvent.click(screen.getByRole('button', { name: 'Add a finding we missed' }))

  expect(card().getByText('Entered by you')).toBeDefined()
  expect(card().getByText('No marker')).toBeDefined()
  expect(card().queryByText('Your report says:')).toBeNull()
  expect(card().getByText(/Choose a bone and a side/)).toBeDefined()
  expect(card().queryByText(/Your report doesn't/)).toBeNull()

  fireEvent.change(card().getByLabelText('Bone for finding 1'), {
    target: { value: 'femur' },
  })
  expect(card().getByText('No marker')).toBeDefined()
  fireEvent.change(card().getByLabelText('Side for finding 1'), {
    target: { value: 'left' },
  })
  expect(card().getByText('Will be marked on the skeleton')).toBeDefined()
})

test('a finding with no side gets no marker until the side is set', async () => {
  showDraft(withFinding({ side: '', status: 'side_not_stated' }))
  await renderScreen()
  expect(card().getByText('No marker')).toBeDefined()
  expect(card().getByText(/doesn't say which side/)).toBeDefined()

  fireEvent.change(card().getByLabelText('Side for finding 1'), {
    target: { value: 'left' },
  })
  expect(card().getByText('Will be marked on the skeleton')).toBeDefined()
  expect(card().queryByText(/doesn't say which side/)).toBeNull()
})

test('a finding with no bone gets no marker and says why', async () => {
  showDraft(withFinding({ bone: '', side: 'left', status: 'bone_not_stated' }))
  await renderScreen()
  expect(card().getByText('No marker')).toBeDefined()
  expect(card().getByText(/doesn't say which bone/)).toBeDefined()
  expect(card().getByRole('heading').textContent).toContain('Bone not chosen')
})

test('a finding outside coverage gets no marker and says why', async () => {
  showDraft(withFinding({ bone: '', side: '', status: 'outside_coverage' }))
  await renderScreen()
  expect(card().getByText('No marker')).toBeDefined()
  expect(card().getByText(/It's still in your original report/)).toBeDefined()
  expect(card().getByRole('heading').textContent).toContain(
    "A bone the app doesn't cover",
  )
})

test('an uncertain finding is labeled in words, not by color', async () => {
  showDraft(withFinding({ certainty: 'uncertain' }))
  await renderScreen()
  expect(card().getByText('Possible fracture')).toBeDefined()
})

test('with no fractures, it says so and can still be confirmed', async () => {
  showDraft({ findings: [] })
  await renderScreen()
  expect(screen.getByText(/didn't find any fractures/)).toBeDefined()
  expect(confirmButton()).toHaveProperty('disabled', false)
})

test('never words a finding as a verdict about healing', async () => {
  showDraft(withFinding({ healing_words: ['healing'] }))
  await renderScreen()
  const text = screen.getByRole('main').textContent ?? ''
  expect(text).toContain('Healing words in your report: healing')
  expect(text).toContain('care team')
  expect(text).not.toMatch(/healing (well|normally)|looks? (good|worse|better)/i)
})

// S1.2: the exam date.

function dateInput() {
  return screen.getByLabelText('Exam date')
}

test('the date in the report is filled in and saved as from the report', async () => {
  showDraft()
  await renderScreen()
  expect(dateInput()).toHaveProperty('value', '2026-09-14')

  fireEvent.click(confirmButton())

  await waitFor(() => expect(saveReport).toHaveBeenCalled())
  expect(vi.mocked(saveReport).mock.calls[0][1]).toEqual({
    examDate: '2026-09-14',
    source: 'report',
  })
})

test('a date the patient changes is saved as from the patient', async () => {
  showDraft()
  await renderScreen()
  fireEvent.change(dateInput(), { target: { value: '2026-09-15' } })
  fireEvent.click(confirmButton())
  await waitFor(() => expect(saveReport).toHaveBeenCalled())
  expect(vi.mocked(saveReport).mock.calls[0][1]).toEqual({
    examDate: '2026-09-15',
    source: 'patient',
  })
})

test('a report with no date can not be saved until the patient enters one', async () => {
  showDraft({ exam_date: null })
  await renderScreen()
  expect(confirmButton()).toHaveProperty('disabled', true)
  expect(screen.getByRole('alert').textContent).toContain('Enter the date')

  fireEvent.change(dateInput(), { target: { value: '2026-09-14' } })
  expect(confirmButton()).toHaveProperty('disabled', false)
})

test('a date in the future can not be saved', async () => {
  showDraft()
  await renderScreen()
  fireEvent.change(dateInput(), { target: { value: '2999-01-01' } })
  expect(confirmButton()).toHaveProperty('disabled', true)
  expect(screen.getByRole('alert').textContent).toContain('future')
})

test('several dates let the patient choose one', async () => {
  showDraft({
    exam_date: null,
    candidate_dates: ['2026-09-14', '2026-10-12'],
  })
  await renderScreen()
  fireEvent.click(screen.getByRole('button', { name: 'Use Oct 12, 2026' }))
  expect(dateInput()).toHaveProperty('value', '2026-10-12')
  fireEvent.click(confirmButton())
  await waitFor(() => expect(saveReport).toHaveBeenCalled())
  expect(vi.mocked(saveReport).mock.calls[0][1].source).toBe('report')
})

test('a failed save says so and keeps the draft', async () => {
  vi.mocked(saveReport).mockRejectedValueOnce(new Error('Could not save.'))
  showDraft()
  await renderScreen()
  fireEvent.click(confirmButton())
  expect((await screen.findByRole('alert')).textContent).toBe('Could not save.')
  expect(window.location.pathname).toBe('/verify-findings')
  expect(screen.getByRole('listitem', { name: 'Finding 1' })).toBeDefined()
})
