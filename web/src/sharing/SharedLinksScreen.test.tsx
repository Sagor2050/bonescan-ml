import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { ShareLink } from './shareLinks.ts'

const mocks = vi.hoisted(() => ({
  loadShareLinks: vi.fn(),
  changeShareLinkExpiry: vi.fn(),
  turnOffShareLink: vi.fn(),
}))

vi.mock('./shareStore.ts', () => mocks)

const { default: SharedLinksScreen } = await import('./SharedLinksScreen.tsx')

const base = {
  createdAt: '2026-11-20T15:00:00Z',
  revokedAt: null,
  reports: [{ id: 'r1', examDate: '2026-09-14' }],
}
const links: ShareLink[] = [
  { ...base, id: 'active', expiresAt: '2026-12-20T15:00:00Z', state: 'active' },
  { ...base, id: 'never', expiresAt: null, state: 'active' },
  { ...base, id: 'expired', expiresAt: '2026-11-21T15:00:00Z', state: 'expired' },
  {
    ...base,
    id: 'off',
    expiresAt: null,
    revokedAt: '2026-11-22T15:00:00Z',
    state: 'turned_off',
  },
]

async function rows() {
  const list = await screen.findByRole('list', { name: 'Your shared links' })
  return within(list).getAllByRole('listitem')
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.loadShareLinks.mockResolvedValue(links)
  mocks.changeShareLinkExpiry.mockResolvedValue(undefined)
  mocks.turnOffShareLink.mockResolvedValue(undefined)
})

test('one row per link, with its reports, dates, and state in words', async () => {
  render(<SharedLinksScreen />)
  const [active, never, expired, off] = await rows()

  expect(active.textContent).toContain('Sep 14, 2026')
  expect(active.textContent).toContain('Nov 20, 2026')
  expect(active.textContent).toContain('Dec 20, 2026')
  expect(active.textContent).toContain('Active')
  expect(within(never).getByText('Never')).toBeTruthy()
  expect(expired.textContent).toContain('Expired')
  expect(off.textContent).toContain('Turned off')
})

test('shows no link address and no view counts', async () => {
  render(<SharedLinksScreen />)
  await rows()

  expect(screen.queryByText(/\/s\//)).toBeNull()
  expect(screen.queryByText(/\d+ views?|opened/i)).toBeNull()
})

test('a turned-off link has nothing left to change', async () => {
  render(<SharedLinksScreen />)
  const off = (await rows())[3]

  expect(within(off).queryByRole('button')).toBeNull()
})

test('turning a link off asks first, and keeping it on changes nothing', async () => {
  render(<SharedLinksScreen />)
  const active = (await rows())[0]

  fireEvent.click(within(active).getByRole('button', { name: 'Turn off' }))
  expect(within(active).getByText(/stops working right away/)).toBeTruthy()
  fireEvent.click(within(active).getByRole('button', { name: 'Keep it on' }))

  expect(mocks.turnOffShareLink).not.toHaveBeenCalled()
})

test('turning a link off happens once confirmed, and the list reloads', async () => {
  render(<SharedLinksScreen />)
  const active = (await rows())[0]

  fireEvent.click(within(active).getByRole('button', { name: 'Turn off' }))
  fireEvent.click(within(active).getByRole('button', { name: 'Yes, turn it off' }))

  await vi.waitFor(() => expect(mocks.loadShareLinks).toHaveBeenCalledTimes(2))
  expect(mocks.turnOffShareLink).toHaveBeenCalledWith('active')
})

test('changing the expiry to never warns first, then saves', async () => {
  render(<SharedLinksScreen />)
  const expired = (await rows())[2]

  fireEvent.click(within(expired).getByRole('button', { name: 'Change expiry' }))
  fireEvent.change(within(expired).getByLabelText(/Stops working after/), {
    target: { value: 'never' },
  })
  expect(within(expired).getByText('This link will never expire.')).toBeTruthy()
  fireEvent.click(within(expired).getByRole('button', { name: 'Save expiry' }))

  await vi.waitFor(() => expect(mocks.changeShareLinkExpiry).toHaveBeenCalledWith('expired', null))
})

test('a link whose reports were all deleted says so and can only be turned off', async () => {
  mocks.loadShareLinks.mockResolvedValue([
    { ...base, id: 'empty', expiresAt: null, reports: [], state: 'expired' },
  ])
  render(<SharedLinksScreen />)
  const [empty] = await rows()

  expect(empty.textContent).toContain('They were deleted')
  expect(within(empty).queryByRole('button', { name: 'Change expiry' })).toBeNull()
  expect(within(empty).getByRole('button', { name: 'Turn off' })).toBeTruthy()
})

test('with no links it says so', async () => {
  mocks.loadShareLinks.mockResolvedValue([])
  render(<SharedLinksScreen />)

  expect(await screen.findByText("You haven't made any links yet.")).toBeTruthy()
})
