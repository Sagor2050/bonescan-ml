import { render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { useSession, type SessionState } from '../account/session.ts'
import HomePage from './HomePage.tsx'

vi.mock('../account/session.ts', () => ({ useSession: vi.fn() }))
// The 3D model needs a real browser, so e2e/home.spec.ts covers it.
vi.mock('./TurningSkeleton.tsx', () => ({ default: () => null }))

beforeEach(() => {
  vi.mocked(useSession).mockReturnValue({ status: 'no-accounts' })
  window.history.replaceState(null, '', '/')
})

test('a patient signed in by a confirmation link goes to their timeline', async () => {
  vi.mocked(useSession).mockReturnValue({
    status: 'signed-in',
  } as SessionState)
  render(<HomePage />)
  await vi.waitFor(() => expect(window.location.pathname).toBe('/reports'))
})

test('a signed-out visitor stays on the homepage', () => {
  vi.mocked(useSession).mockReturnValue({ status: 'signed-out' })
  render(<HomePage />)
  expect(window.location.pathname).toBe('/')
})

test('shows the heading and both ways to get started', () => {
  render(<HomePage />)
  expect(
    screen.getByRole('heading', {
      level: 1,
      name: 'Understand your imaging report in 3D',
    }),
  ).toBeDefined()
  expect(
    screen.getByRole('link', { name: 'Create account' }).getAttribute('href'),
  ).toBe('/create-account')
  expect(screen.getAllByRole('link', { name: 'Sign in' })).toHaveLength(2)
})

test('says the skeleton is not the patient’s own bones', () => {
  render(<HomePage />)
  expect(screen.getByText(/standard adult model/)).toBeDefined()
  expect(screen.getAllByText(/not a model of your\s+own bones/)).toHaveLength(2)
})

test('says it does not diagnose and points back to the care team', () => {
  render(<HomePage />)
  expect(
    screen.getByText(/does not diagnose you, predict how you will heal/),
  ).toBeDefined()
  expect(screen.getByText(/Ask them about your results/)).toBeDefined()
})

test('the About link goes to the section on what the app does', () => {
  const { container } = render(<HomePage />)
  expect(
    screen.getByRole('link', { name: 'About' }).getAttribute('href'),
  ).toBe('#about')
  expect(container.querySelector('#about h2')?.textContent).toBe(
    'What BoneScan does and does not do',
  )
})

test('offers a quick demo that is clearly not available yet', () => {
  render(<HomePage />)
  const demo = screen.getByRole('button', { name: /Quick demo/ })
  expect(demo.textContent).toContain('coming soon')
  expect((demo as HTMLButtonElement).disabled).toBe(true)
})

test('says beside the skeleton that it is not the patient’s own', () => {
  render(<HomePage />)
  expect(
    screen.getByText(
      'This is a standard adult skeleton, not a model of your own bones.',
    ),
  ).toBeDefined()
})
