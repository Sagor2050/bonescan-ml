import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import Link from './Link.tsx'
import { matchPath, navigate, usePath } from './router.ts'

function CurrentPath() {
  return <p data-testid="path">{usePath()}</p>
}

function shownPath() {
  return screen.getByTestId('path').textContent
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

test.each([
  ['/', '/', {}],
  ['/sign-in', '/sign-in', {}],
  ['/sign-in', '/sign-in/', {}],
  ['/reports/:reportId', '/reports/abc-123', { reportId: 'abc-123' }],
  ['/reports/:reportId', '/reports/a%20b', { reportId: 'a b' }],
])('matchPath(%s, %s) matches', (pattern, path, params) => {
  expect(matchPath(pattern, path)).toEqual(params)
})

test.each([
  ['/', '/sign-in'],
  ['/sign-in', '/'],
  ['/sign-in', '/sign-in/extra'],
  ['/reports/:reportId', '/reports'],
  ['/reports/:reportId', '/reports/a/b'],
  // A malformed link must not crash the app.
  ['/reports/:reportId', '/reports/%E0%A4%A'],
])('matchPath(%s, %s) does not match', (pattern, path) => {
  expect(matchPath(pattern, path)).toBeNull()
})

test('navigate changes the path that components see', () => {
  render(<CurrentPath />)
  expect(shownPath()).toBe('/')

  act(() => navigate('/reports'))

  expect(shownPath()).toBe('/reports')
  expect(window.location.pathname).toBe('/reports')
})

test('navigate can replace the current history entry', () => {
  const entriesBefore = window.history.length

  navigate('/reports', { replace: true })

  expect(window.location.pathname).toBe('/reports')
  expect(window.history.length).toBe(entriesBefore)
})

test('going back in the browser updates the path that components see', () => {
  render(<CurrentPath />)
  act(() => navigate('/reports'))

  window.history.replaceState(null, '', '/')
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

  expect(shownPath()).toBe('/')
})

test('clicking a Link changes the path without loading a new page', () => {
  render(
    <>
      <CurrentPath />
      <Link href="/reports">My reports</Link>
    </>,
  )
  const link = screen.getByRole('link', { name: 'My reports' })

  // fireEvent returns false when the click's default action was prevented.
  expect(fireEvent.click(link)).toBe(false)

  expect(shownPath()).toBe('/reports')
})

// Stops jsdom trying to follow a link that the Link component left alone.
function renderLinkInPage(target?: string) {
  render(
    <div onClick={(event) => event.preventDefault()}>
      <CurrentPath />
      <Link href="/reports" target={target}>
        My reports
      </Link>
    </div>,
  )
  return screen.getByRole('link', { name: 'My reports' })
}

test.each([
  ['ctrl', { ctrlKey: true }],
  ['cmd', { metaKey: true }],
  ['shift', { shiftKey: true }],
  ['middle-button', { button: 1 }],
])('a %s click on a Link is left to the browser', (_name, click) => {
  fireEvent.click(renderLinkInPage(), click)

  expect(shownPath()).toBe('/')
})

test('a Link that opens in a new tab is left to the browser', () => {
  fireEvent.click(renderLinkInPage('_blank'))

  expect(shownPath()).toBe('/')
})
