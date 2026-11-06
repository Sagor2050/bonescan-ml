import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  useSession: vi.fn(),
}))

vi.mock('./auth.ts', () => ({ deleteAccount: mocks.deleteAccount }))
vi.mock('./session.ts', () => ({ useSession: mocks.useSession }))

const { default: AccountScreen } = await import('./AccountScreen.tsx')

function renderSignedIn() {
  mocks.useSession.mockReturnValue({
    status: 'signed-in',
    session: { user: { email: 'a@b.co' } },
  })
  render(<AccountScreen />)
}

function openConfirmation() {
  renderSignedIn()
  fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
}

function submit(password: string) {
  fireEvent.change(screen.getByLabelText(/Enter your password/), {
    target: { value: password },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Yes, delete everything' }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

test('shows who is signed in', () => {
  renderSignedIn()

  expect(screen.getByText('a@b.co')).toBeTruthy()
})

test('asks for the password first, and deletes nothing until then', () => {
  openConfirmation()

  expect(screen.getByText(/You can't get them back/)).toBeTruthy()
  expect(screen.getByLabelText(/Enter your password/)).toBeTruthy()
  expect(mocks.deleteAccount).not.toHaveBeenCalled()
})

test('keeping the account deletes nothing', () => {
  openConfirmation()

  fireEvent.click(screen.getByRole('button', { name: 'Keep my account' }))

  expect(mocks.deleteAccount).not.toHaveBeenCalled()
  expect(screen.queryByLabelText(/Enter your password/)).toBeNull()
})

test('deletes with the password entered, and can’t run twice', async () => {
  mocks.deleteAccount.mockReturnValue(new Promise(() => {}))
  openConfirmation()

  submit('secret')

  expect(mocks.deleteAccount).toHaveBeenCalledWith('secret')
  const deleting = await screen.findByRole('button', { name: 'Deleting…' })
  expect((deleting as HTMLButtonElement).disabled).toBe(true)
})

test('a failed attempt says why, clears the password, and can be retried', async () => {
  mocks.deleteAccount.mockRejectedValue(new Error("That password isn't right."))
  openConfirmation()

  submit('wrong')

  expect((await screen.findByRole('alert')).textContent).toBe(
    "That password isn't right.",
  )
  expect(
    (screen.getByLabelText(/Enter your password/) as HTMLInputElement).value,
  ).toBe('')
  expect(
    (
      screen.getByRole('button', {
        name: 'Yes, delete everything',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false)
})

test('with no accounts it offers nothing to delete', () => {
  mocks.useSession.mockReturnValue({ status: 'no-accounts' })
  render(<AccountScreen />)

  expect(screen.getByText(/aren't set up/)).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
})
