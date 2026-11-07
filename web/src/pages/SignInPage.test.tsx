import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import {
  EmailNotConfirmedError,
  requestPasswordReset,
  resendConfirmation,
  signIn,
} from '../account/auth.ts'
import SignInPage from './SignInPage.tsx'

vi.mock('../account/auth.ts', async (original) => ({
  ...(await original<typeof import('../account/auth.ts')>()),
  signIn: vi.fn(async () => {}),
  requestPasswordReset: vi.fn(async () => {}),
  resendConfirmation: vi.fn(async () => {}),
}))

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

beforeEach(() => {
  vi.mocked(signIn).mockClear()
  vi.mocked(requestPasswordReset).mockClear()
  vi.mocked(resendConfirmation).mockClear()
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

const NEW_LINK = 'Send a new confirmation link'

test('an unconfirmed email can ask for a new link right there', async () => {
  vi.mocked(signIn).mockRejectedValueOnce(
    new EmailNotConfirmedError('Please confirm your email address first.'),
  )
  render(<SignInPage />)
  type('Email address', 'a@example.com')
  type('Password', 'long enough')
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  fireEvent.click(await screen.findByRole('button', { name: NEW_LINK }))

  await screen.findByRole('heading', { name: 'Check your email' })
  expect(resendConfirmation).toHaveBeenCalledWith('a@example.com')
  expect(document.body.textContent).toContain('If a@example.com still needs')
  expect(document.body.textContent).toContain('older links no longer work')
})

test('other sign-in failures do not offer a new link', async () => {
  vi.mocked(signIn).mockRejectedValueOnce(new Error("They don't match."))
  render(<SignInPage />)
  type('Email address', 'a@example.com')
  type('Password', 'wrong')
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  await screen.findByRole('alert')
  expect(screen.queryByRole('button', { name: NEW_LINK })).toBeNull()
})

test('a failed email link says so and can send a new one', async () => {
  window.history.replaceState(null, '', '/sign-in?link=failed')
  render(<SignInPage />)
  expect(screen.getByRole('status').textContent).toContain(
    "That email link didn't work.",
  )

  fireEvent.click(screen.getByRole('button', { name: NEW_LINK }))
  await screen.findByRole('heading', { name: 'Confirm your email' })
  type('Email address', 'a@example.com')
  fireEvent.click(screen.getByRole('button', { name: 'Send the link' }))

  await screen.findByRole('heading', { name: 'Check your email' })
  expect(resendConfirmation).toHaveBeenCalledWith('a@example.com')
})

test('the failed-link message is gone after sending a new link', async () => {
  window.history.replaceState(null, '', '/sign-in?link=failed')
  render(<SignInPage />)
  fireEvent.click(screen.getByRole('button', { name: NEW_LINK }))
  await screen.findByRole('heading', { name: 'Confirm your email' })
  type('Email address', 'a@example.com')
  fireEvent.click(screen.getByRole('button', { name: 'Send the link' }))
  await screen.findByRole('heading', { name: 'Check your email' })

  fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }))

  await screen.findByRole('heading', { name: 'Sign in' })
  expect(screen.queryByRole('status')).toBeNull()
})

test('a normal visit shows no failed-link message', () => {
  render(<SignInPage />)
  expect(screen.queryByRole('status')).toBeNull()
})
