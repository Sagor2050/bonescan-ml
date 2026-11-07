import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { paths } from '../routing/paths.ts'
import type { SavedReport } from './reportStore.ts'

const mocks = vi.hoisted(() => ({
  deleteReport: vi.fn(),
  forgetReport: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('./reportStore.ts', () => ({
  deleteReport: mocks.deleteReport,
  isSample: (id: string) => id.startsWith('sample-'),
}))
vi.mock('./workspaceState.ts', () => ({
  useWorkspace: () => ({ forgetReport: mocks.forgetReport }),
}))
vi.mock('../routing/router.ts', () => ({ navigate: mocks.navigate }))

const { default: DeleteReport } = await import('./DeleteReport.tsx')

const report = { id: 'report-1', file_path: 'user/report-1.pdf' } as SavedReport

function openConfirmation() {
  render(<DeleteReport report={report} />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete this report' }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

test('asks first, and deletes nothing until the patient confirms', () => {
  openConfirmation()

  expect(screen.getByText('Delete this report?')).toBeTruthy()
  expect(screen.getByText(/You can't get it back/)).toBeTruthy()
  expect(mocks.deleteReport).not.toHaveBeenCalled()
})

test('the safe choice has the focus when it asks', () => {
  openConfirmation()

  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Keep the report' }),
  )
})

test('it asks over the screen, as a dialog that says what it’s about', () => {
  openConfirmation()

  const dialog = screen.getByRole('alertdialog', { name: 'Delete this report' })
  expect(dialog.getAttribute('aria-modal')).toBe('true')
  expect(
    document.getElementById(dialog.getAttribute('aria-describedby') ?? '')
      ?.textContent,
  ).toMatch(/You can't get it back/)
})

test('Escape keeps the report, and focus goes back to where it started', () => {
  openConfirmation()

  fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })

  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(mocks.deleteReport).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Delete this report' }),
  )
})

test('Tab stays inside the question while it’s open', () => {
  openConfirmation()
  const keep = screen.getByRole('button', { name: 'Keep the report' })
  const yes = screen.getByRole('button', { name: 'Yes, delete it' })
  const dialog = screen.getByRole('alertdialog')

  keep.focus()
  fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(yes)

  fireEvent.keyDown(dialog, { key: 'Tab' })
  expect(document.activeElement).toBe(keep)
})

test('keeping the report deletes nothing', () => {
  openConfirmation()

  fireEvent.click(screen.getByRole('button', { name: 'Keep the report' }))

  expect(mocks.deleteReport).not.toHaveBeenCalled()
  expect(screen.queryByText('Delete this report?')).toBeNull()
  // Keyboard users carry on from the button they started at.
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Delete this report' }),
  )
})

test('after deleting, the timeline forgets the report and opens', async () => {
  mocks.deleteReport.mockResolvedValue(undefined)
  openConfirmation()

  fireEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  await vi.waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith(paths.reports))
  expect(mocks.deleteReport).toHaveBeenCalledWith(report)
  expect(mocks.forgetReport).toHaveBeenCalledWith('report-1')
})

test('a failed delete says so, stays on the report, and can be retried', async () => {
  mocks.deleteReport.mockRejectedValueOnce(new Error('down'))
  mocks.deleteReport.mockResolvedValueOnce(undefined)
  openConfirmation()

  fireEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  expect((await screen.findByRole('alert')).textContent).toContain(
    "We couldn't delete your report",
  )
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(mocks.forgetReport).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  await vi.waitFor(() => expect(mocks.navigate).toHaveBeenCalled())
})

test('the buttons are off while it deletes, so it can’t run twice', async () => {
  mocks.deleteReport.mockReturnValue(new Promise(() => {}))
  openConfirmation()

  fireEvent.click(screen.getByRole('button', { name: 'Yes, delete it' }))

  const deleting = await screen.findByRole('button', { name: 'Deleting…' })
  const keep = screen.getByRole('button', { name: 'Keep the report' })
  expect((deleting as HTMLButtonElement).disabled).toBe(true)
  expect((keep as HTMLButtonElement).disabled).toBe(true)
})

test('the fictional samples can’t be deleted', () => {
  render(<DeleteReport report={{ ...report, id: 'sample-b1' }} />)

  expect(screen.queryByRole('button')).toBeNull()
})
