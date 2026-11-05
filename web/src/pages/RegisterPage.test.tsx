import { render, screen } from '@testing-library/react'
import { test, expect } from 'vitest'
import RegisterPage from './RegisterPage'

test('renders the registration page', () => {
  render(<RegisterPage />)

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
