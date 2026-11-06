import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { createAccount } from '../account/auth.ts'
import RegisterPage from './RegisterPage.tsx'

vi.mock('../account/auth.ts', async (original) => ({
  ...(await original<typeof import('../account/auth.ts')>()),
  createAccount: vi.fn(async () => {}),
}))

function fill(email: string, password: string, confirm = password) {
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: email },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: password },
  })
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: confirm },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
}

beforeEach(() => vi.mocked(createAccount).mockClear())

test('renders the registration page', () => {
  render(<RegisterPage />)
  expect(
    screen.getByRole('heading', { level: 1, name: 'Create account' }),
  ).toBeDefined()
  expect(screen.getByRole('textbox', { name: 'Email address' })).toBeDefined()
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDefined()
})

test('asks for nothing but an email address and a password', () => {
  const { container } = render(<RegisterPage />)
  const fields = [...container.querySelectorAll('input')].map((i) => i.type)
  expect(fields).toEqual(['email', 'password', 'password'])
})

test('a short password is refused before anything is sent', () => {
  render(<RegisterPage />)
  fill('a@example.com', 'short')
  expect(screen.getByRole('alert').textContent).toContain('at least 8')
  expect(createAccount).not.toHaveBeenCalled()
})

test('passwords that differ are refused before anything is sent', () => {
  render(<RegisterPage />)
  fill('a@example.com', 'long enough', 'different one')
  expect(screen.getByRole('alert').textContent).toContain('do not match')
  expect(createAccount).not.toHaveBeenCalled()
})

test('tells the patient to confirm their email, and never simulates it', async () => {
  render(<RegisterPage />)
  fill('a@example.com', 'long enough')
  await screen.findByRole('heading', { name: 'Check your email' })
  expect(createAccount).toHaveBeenCalledWith('a@example.com', 'long enough')
  expect(screen.getByText('a@example.com')).toBeDefined()
  expect(screen.queryByRole('button', { name: /simulate/i })).toBeNull()
})

test('the message never says whether an address already has an account', async () => {
  render(<RegisterPage />)
  fill('a@example.com', 'long enough')
  await waitFor(() =>
    expect(document.body.textContent).toContain(
      'If this address already has an account',
    ),
  )
})

test('a failure says so and keeps the form', async () => {
  vi.mocked(createAccount).mockRejectedValueOnce(new Error('Please try again.'))
  render(<RegisterPage />)
  fill('a@example.com', 'long enough')
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Please try again.',
  )
  expect(screen.getByLabelText('Email address')).toBeDefined()
})
