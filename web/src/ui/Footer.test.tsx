import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import Footer from './Footer.tsx'

test('says what the app is not, and points back to the care team', () => {
  render(<Footer />)
  const footer = screen.getByRole('contentinfo')
  expect(footer.textContent).toContain('not a medical device')
  expect(footer.textContent).toContain('does not give medical advice')
  expect(footer.textContent).toContain('Ask your care team')
})

test('says who made it and links to the source code', () => {
  render(<Footer />)
  expect(screen.getByRole('contentinfo').textContent).toContain('The White Coats')
  expect(
    screen.getByRole('link', { name: 'Source code' }).getAttribute('href'),
  ).toContain('github.com')
})
