import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import catalog from '../../public/shared/bones.json'
import type { MarkerSpec } from '../viewer/markers.ts'
import { LINK_UNAVAILABLE } from './LinkUnavailableScreen.tsx'
import {
  OWNER_EMAIL,
  OWNER_ID,
  sharedResponse,
  TOKEN,
} from './sharedReports.fixture.ts'
import SharedReportsScreen from './SharedReportsScreen.tsx'

// WebGL doesn't run in jsdom. The stand-in shows what each marker says.
vi.mock('../viewer/SkeletonViewer.tsx', () => ({
  default: ({ markers }: { markers: MarkerSpec[] }) => (
    <section aria-label="3D skeleton">
      {markers.map((marker) => (
        <span key={marker.findingId}>{marker.sideLabel}</span>
      ))}
    </section>
  ),
}))

// Anything a patient uses to change their reports or account. None of it may
// appear for someone viewing a shared link.
const EDIT_CONTROL =
  /\b(add|change|edit|delete|remove|confirm|share|save|sign|account|my reports)\b/i

let sharedApi: () => Response

beforeEach(() => {
  sharedApi = () => Response.json(sharedResponse())
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        url.startsWith('/api/shared/') ? sharedApi() : Response.json(catalog),
      ),
    ),
  )
})

async function renderScreen(token = TOKEN) {
  let view: ReturnType<typeof render> | undefined
  await act(async () => {
    view = render(<SharedReportsScreen token={token} />)
  })
  return view!
}

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

function controls() {
  return [...screen.queryAllByRole('button'), ...screen.queryAllByRole('link')]
}

function expectNoEditControls() {
  const names = controls().map(
    (control) => control.textContent + ' ' + (control.getAttribute('aria-label') ?? ''),
  )
  expect(names.filter((name) => EDIT_CONTROL.test(name))).toEqual([])
  expect(names.length).toBeGreaterThan(0)
}

describe('an active link', () => {
  test('shows the shared reports in exam order, on the model', async () => {
    await renderScreen()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Shared reports' }),
    ).toBeTruthy()
    const dates = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent)
      .filter((text) => text?.includes(', 2026'))
    expect(dates[0]).toContain('Sep 14, 2026')
    expect(dates[1]).toContain('Oct 12, 2026')
    expect(screen.getByText('Report 2 of 2')).toBeTruthy()
    expect(
      screen.getByRole('region', { name: '3D skeleton' }).textContent,
    ).toContain("The patient's left side")
  })

  test('renders no add, change, delete, confirm, or share control', async () => {
    await renderScreen()
    expectNoEditControls()

    await click('Compare reports')
    expectNoEditControls()
    await click('Stop comparing')

    await click('Open with the original report')
    expect(
      screen.getByRole('heading', { name: 'Shared report and skeleton' }),
    ).toBeTruthy()
    expectNoEditControls()
  })

  test('opens a report beside the original without leaving the link', async () => {
    await renderScreen()
    await click('Open with the original report')
    expect(screen.getByRole('tab', { name: 'The original report' })).toBeTruthy()
    expect(document.querySelector('a[href^="/reports"]')).toBeNull()

    await click('← All shared reports')
    expect(screen.getByRole('heading', { name: 'Shared reports' })).toBeTruthy()
  })

  test('shows nothing about the owner', async () => {
    const { container } = await renderScreen()
    for (const html of [container.innerHTML, document.head.innerHTML]) {
      expect(html).not.toContain(OWNER_ID)
      expect(html).not.toContain(OWNER_EMAIL)
    }
  })

  test('marks a report the patient has not confirmed', async () => {
    sharedApi = () => Response.json(sharedResponse({ b2Confirmed: false }))
    await renderScreen()
    // In the list, and beside the report being shown.
    expect(screen.getAllByText('Unconfirmed')).toHaveLength(2)
  })

  test('confirmed reports carry no badge', async () => {
    await renderScreen()
    expect(screen.queryByText('Unconfirmed')).toBeNull()
  })

  test('tells search engines and other sites nothing', async () => {
    const { unmount } = await renderScreen()
    expect(
      document.head.querySelector('meta[name="robots"]')?.getAttribute('content'),
    ).toBe('noindex, nofollow')
    expect(
      document.head
        .querySelector('meta[name="referrer"]')
        ?.getAttribute('content'),
    ).toBe('no-referrer')
    unmount()
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
  })
})

describe('a link that does not work', () => {
  async function deadPage(token: string) {
    const { container, unmount } = await renderScreen(token)
    const html = container.innerHTML
    unmount()
    return html
  }

  test('expired, revoked, deleted, and unknown links give the same page', async () => {
    // The server gives every one of these the same 404.
    sharedApi = () =>
      Response.json({ error: LINK_UNAVAILABLE }, { status: 404 })
    const notFound = await deadPage(TOKEN)
    sharedApi = () => Response.json({ reports: [] })
    const noReportsLeft = await deadPage(TOKEN)
    const malformed = await deadPage('not-a-real-token')

    expect(notFound).toContain(LINK_UNAVAILABLE)
    expect(noReportsLeft).toBe(notFound)
    expect(malformed).toBe(notFound)
  })

  test('says only that the link is no longer available', async () => {
    sharedApi = () => Response.json({}, { status: 404 })
    const { container } = await renderScreen()
    expect(container.textContent).toBe(LINK_UNAVAILABLE)
    expect(controls()).toEqual([])
  })
})
