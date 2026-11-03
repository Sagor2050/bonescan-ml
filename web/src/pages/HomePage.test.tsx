import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import HomePage from './HomePage.tsx'

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
  expect(screen.getByText(/not a model of your\s+own bones/)).toBeDefined()
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
