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

test('lists the team and its developers', () => {
  render(<Footer />)
  const team = screen.getByRole('region', { name: 'Team' })
  expect(team.textContent).toContain('The White Coats')
  for (const name of ['Aliz', 'Jennifer', 'Justin', 'Sagor']) {
    expect(screen.getByText(name).tagName).toBe('LI')
  }
})

test.each([
  ['Source code', /github\.com\/Sagor2050\/bonescan-ml$/],
  ['Requirements', /docs\/requirements\.pdf$/],
  ['Project plan', /docs\/project-plan\.pdf$/],
])('links to the %s', (name, href) => {
  render(<Footer />)
  expect(screen.getByRole('link', { name }).getAttribute('href')).toMatch(href)
})

test('uses the app’s name', () => {
  render(<Footer />)
  expect(screen.getByRole('contentinfo').textContent).toContain('BoneScan3D')
})
