import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import App from './App'

test('renders the registration page', () => {
  render(<App />)

  expect(
    screen.getByRole('heading', { name: '3D Medical Report Viewer' })
  ).toBeDefined()

  expect(
    screen.getByRole('heading', { name: 'Create Account' })
  ).toBeDefined()

  expect(
    screen.getByRole('textbox', { name: 'Email Address' })
  ).toBeDefined()

  expect(
    screen.getByRole('button', { name: 'Create Account' })
  ).toBeDefined()
})
