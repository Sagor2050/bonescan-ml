import { render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import RequireSignIn from './RequireSignIn.tsx'
import { useSession, type SessionState } from './session.ts'

vi.mock('./session.ts', () => ({ useSession: vi.fn() }))

function renderAs(state: SessionState) {
  vi.mocked(useSession).mockReturnValue(state)
  render(<RequireSignIn>private screen</RequireSignIn>)
}

beforeEach(() => window.history.replaceState(null, '', '/reports'))

test('a signed-out visitor goes to sign in and sees nothing private', () => {
  renderAs({ status: 'signed-out' })
  expect(screen.queryByText('private screen')).toBeNull()
  expect(window.location.pathname).toBe('/sign-in')
})

test('nothing private shows while the session is loading', () => {
  renderAs({ status: 'loading' })
  expect(screen.queryByText('private screen')).toBeNull()
  expect(window.location.pathname).toBe('/reports')
})

test('a signed-in patient sees the screen', () => {
  renderAs({ status: 'signed-in', session: {} as never })
  expect(screen.getByText('private screen')).toBeDefined()
})

test('with no accounts set up, the screen still shows for development', () => {
  renderAs({ status: 'no-accounts' })
  expect(screen.getByText('private screen')).toBeDefined()
})
