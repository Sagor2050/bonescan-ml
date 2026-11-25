import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadDefaultShareExpiry: vi.fn(),
  saveDefaultShareExpiry: vi.fn(),
}))

vi.mock('./shareStore.ts', () => mocks)

const { default: ShareSettings } = await import('./ShareSettings.tsx')

const select = () => screen.getByLabelText('Default link expiry') as HTMLSelectElement

beforeEach(() => {
  vi.clearAllMocks()
  mocks.loadDefaultShareExpiry.mockResolvedValue(30)
  mocks.saveDefaultShareExpiry.mockResolvedValue(undefined)
})

test('shows the saved default, 30 days unless changed', async () => {
  render(<ShareSettings />)

  await screen.findByLabelText('Default link expiry')
  expect(select().value).toBe('30')
})

test('saves a new default', async () => {
  render(<ShareSettings />)
  await screen.findByLabelText('Default link expiry')

  fireEvent.change(select(), { target: { value: '90' } })

  expect(await screen.findByText('Saved.')).toBeTruthy()
  expect(mocks.saveDefaultShareExpiry).toHaveBeenCalledWith(90)
})

test('a default of never warns that new links won’t expire', async () => {
  render(<ShareSettings />)
  await screen.findByLabelText('Default link expiry')

  fireEvent.change(select(), { target: { value: 'never' } })

  expect(await screen.findByText(/New links will never expire/)).toBeTruthy()
  expect(mocks.saveDefaultShareExpiry).toHaveBeenCalledWith(null)
})

test('a failed save goes back to the old default and says why', async () => {
  mocks.saveDefaultShareExpiry.mockRejectedValue(new Error('Your default could not be saved.'))
  render(<ShareSettings />)
  await screen.findByLabelText('Default link expiry')

  fireEvent.change(select(), { target: { value: '1' } })

  expect(await screen.findByText('Your default could not be saved.')).toBeTruthy()
  expect(select().value).toBe('30')
})

test('links to the shared links page', async () => {
  render(<ShareSettings />)

  expect(
    screen.getByRole('link', { name: /manage your shared links/ }).getAttribute('href'),
  ).toBe('/account/shared-links')
})
