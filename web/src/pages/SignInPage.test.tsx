import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { requestPasswordReset, signIn } from '../account/auth.ts'
import SignInPage from './SignInPage.tsx'

vi.mock('../account/auth.ts', async (original) => ({
  ...(await original<typeof import('../account/auth.ts')>()),
  signIn: vi.fn(async () => {}),
  requestPasswordReset: vi.fn(async () => {}),
}))

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

beforeEach(() => {
  vi.mocked(signIn).mockClear()
  vi.mocked(requestPasswordReset).mockClear()
  window.history.replaceState(null, '', '/sign-in')
})

test('signing in lands on the timeline', async () => {
  render(<SignInPage />)
  type('Email address', 'a@example.com')
  type('Password', 'long enough')
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  await vi.waitFor(() => expect(window.location.pathname).toBe('/reports'))
  expect(signIn).toHaveBeenCalledWith('a@example.com', 'long enough')
})

test('a failed sign-in says so and stays on the screen', async () => {
  vi.mocked(signIn).mockRejectedValueOnce(new Error("They don't match."))
  render(<SignInPage />)
  type('Email address', 'a@example.com')
  type('Password', 'wrong')
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect((await screen.findByRole('alert')).textContent).toBe(
    "They don't match.",
  )
  expect(window.location.pathname).toBe('/sign-in')
})

test('a forgotten password sends a link, without saying if the account exists', async () => {
  render(<SignInPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Forgot your password?' }))
  type('Email address', 'a@example.com')
  fireEvent.click(screen.getByRole('button', { name: 'Send the link' }))
  await screen.findByRole('heading', { name: 'Check your email' })
  expect(requestPasswordReset).toHaveBeenCalledWith('a@example.com')
  expect(document.body.textContent).toContain('If a@example.com has an account')
})
