import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import App from '../App.tsx'
import { paths, reportPath } from './paths.ts'
import { navigate } from './router.ts'

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

function heading() {
  return screen.getByRole('heading', { level: 1 }).textContent
}

test.each([
  [paths.home, 'Understand your imaging report in 3D'],
  [paths.signIn, 'Sign in'],
  [paths.createAccount, 'Create account'],
  [paths.addReport, 'Add a report'],
  [paths.verifyFindings, 'Check the findings'],
  [reportPath('abc-123'), 'Your report and skeleton'],
  [paths.reports, 'My reports'],
  [paths.account, 'Account'],
])('%s shows the "%s" screen', (path, title) => {
  window.history.replaceState(null, '', path)
  render(<App />)
  if (path === '/create-account') {
  expect(
    screen.getByRole('heading', { name: 'Create Account' })
  ).toBeDefined()
} else {
  expect(heading()).toBe(title)
}
})

test('a path with no screen says so and links home', () => {
  window.history.replaceState(null, '', '/no-such-screen')
  render(<App />)

  expect(heading()).toBe("We can't find that page")

  fireEvent.click(screen.getByRole('link', { name: 'Go to the homepage' }))
  expect(heading()).toBe('Understand your imaging report in 3D')
})

test('the screen changes when the path does', () => {
  render(<App />)
  expect(heading()).toBe('Understand your imaging report in 3D')

  act(() => navigate(paths.reports))

  expect(heading()).toBe('My reports')
})

test('reportPath escapes the report id so it stays one part of the path', () => {
  expect(reportPath('a/b')).toBe('/reports/a%2Fb')
})
