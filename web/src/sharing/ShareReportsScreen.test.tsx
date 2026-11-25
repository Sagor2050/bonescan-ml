import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createShareLink: vi.fn(),
  loadDefaultShareExpiry: vi.fn(),
  useReports: vi.fn(),
}))

vi.mock('./shareStore.ts', () => ({
  createShareLink: mocks.createShareLink,
  loadDefaultShareExpiry: mocks.loadDefaultShareExpiry,
}))
vi.mock('../workspace/useReports.ts', () => ({ useReports: mocks.useReports }))
vi.mock('../viewer/bones.ts', () => ({ useBones: () => [] }))

const { default: ShareReportsScreen } = await import('./ShareReportsScreen.tsx')

const reports = [
  { id: 'r1', exam_date: '2026-09-14', findings: [] },
  { id: 'r2', exam_date: '2026-10-12', findings: [] },
]

const makeButton = () =>
  screen.getByRole('button', { name: 'Make the link' }) as HTMLButtonElement

async function renderScreen(defaultExpiry: number | null = 30) {
  mocks.useReports.mockReturnValue({ status: 'ready', reports })
  mocks.loadDefaultShareExpiry.mockResolvedValue(defaultExpiry)
  render(<ShareReportsScreen />)
  await screen.findByRole('button', { name: 'Make the link' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

test('shows the warning before any link is made, and waits for it to be accepted', async () => {
  await renderScreen()

  expect(
    screen.getByText(
      /Anyone who has this link can view these reports until it expires or you turn it off/,
    ),
  ).toBeTruthy()
  fireEvent.click(screen.getByLabelText(/Sep 14, 2026/))
  expect(makeButton().disabled).toBe(true)

  fireEvent.click(screen.getByLabelText('I understand'))
  expect(makeButton().disabled).toBe(false)
  expect(mocks.createShareLink).not.toHaveBeenCalled()
})

test('needs at least one report', async () => {
  await renderScreen()

  fireEvent.click(screen.getByLabelText('I understand'))

  expect(makeButton().disabled).toBe(true)
  expect(screen.getByText('Choose at least one report.')).toBeTruthy()
})

test('starts on the patient’s default expiry', async () => {
  await renderScreen(7)

  const select = screen.getByLabelText('Link stops working after') as HTMLSelectElement
  expect(select.value).toBe('7')
})

test('picking never shows an extra warning', async () => {
  await renderScreen()
  expect(screen.queryByText('This link never expires.')).toBeNull()

  fireEvent.change(screen.getByLabelText('Link stops working after'), {
    target: { value: 'never' },
  })

  expect(screen.getByText('This link never expires.')).toBeTruthy()
  expect(screen.getByText(/keeps working until you turn\s+it off/)).toBeTruthy()
})

test('makes the link with the chosen reports and expiry, then shows it once with Copy', async () => {
  mocks.createShareLink.mockResolvedValue({
    id: 'l1',
    url: 'http://localhost:3000/s/token',
    expiresAt: null,
  })
  await renderScreen()

  fireEvent.click(screen.getByLabelText(/Oct 12, 2026/))
  fireEvent.click(screen.getByLabelText(/Sep 14, 2026/))
  fireEvent.change(screen.getByLabelText('Link stops working after'), {
    target: { value: '14' },
  })
  fireEvent.click(screen.getByLabelText('I understand'))
  fireEvent.click(makeButton())

  expect(await screen.findByText('Your link is ready')).toBeTruthy()
  expect(mocks.createShareLink).toHaveBeenCalledWith(['r1', 'r2'], 14)
  expect((screen.getByLabelText('Share link') as HTMLInputElement).value).toBe(
    'http://localhost:3000/s/token',
  )
  expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy()
  expect(screen.getByText(/can't show this link again/)).toBeTruthy()
})

test('copies the link', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  mocks.createShareLink.mockResolvedValue({ id: 'l1', url: 'http://x/s/t', expiresAt: null })
  await renderScreen()
  fireEvent.click(screen.getByLabelText(/Sep 14, 2026/))
  fireEvent.click(screen.getByLabelText('I understand'))
  fireEvent.click(makeButton())

  fireEvent.click(await screen.findByRole('button', { name: 'Copy' }))

  expect(await screen.findByText('Copied.')).toBeTruthy()
  expect(writeText).toHaveBeenCalledWith('http://x/s/t')
})

test('a failed attempt says so and keeps the choices', async () => {
  mocks.createShareLink.mockRejectedValue(new Error('The link could not be made. Please try again.'))
  await renderScreen()
  fireEvent.click(screen.getByLabelText(/Sep 14, 2026/))
  fireEvent.click(screen.getByLabelText('I understand'))
  fireEvent.click(makeButton())

  expect((await screen.findByRole('alert')).textContent).toMatch(/could not be made/)
  expect((screen.getByLabelText(/Sep 14, 2026/) as HTMLInputElement).checked).toBe(true)
  expect(screen.queryByText('Your link is ready')).toBeNull()
})
