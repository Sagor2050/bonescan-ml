import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import b1 from '../../../tests/fixtures/read-b1-pdf.json'
import AddReportScreen from './AddReportScreen.tsx'
import { setDraftReport, useDraftReport } from './draftReport.ts'

const pdf = new File(['%PDF-'], 'report.pdf', { type: 'application/pdf' })

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

const reader = vi.fn(async () => jsonResponse(b1))

function currentDraft() {
  return renderHook(() => useDraftReport()).result.current
}

function choosePdf() {
  fireEvent.change(screen.getByLabelText(/PDF file/), {
    target: { files: [pdf] },
  })
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Read my report' }))
}

beforeEach(() => {
  setDraftReport(null)
  reader.mockClear()
  vi.stubGlobal('fetch', reader)
  window.history.replaceState(null, '', '/add-report')
})

test('needs a report before it can read one', () => {
  render(<AddReportScreen />)
  expect(
    screen.getByRole('button', { name: 'Read my report' }),
  ).toHaveProperty('disabled', true)
})

test('a PDF goes to the reader, then to checking the findings', async () => {
  render(<AddReportScreen />)
  choosePdf()
  submit()
  await waitFor(() =>
    expect(window.location.pathname).toBe('/verify-findings'),
  )
  const [url, options] = reader.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toMatch(/\/read$/)
  expect((options.body as FormData).get('file')).toBeInstanceOf(File)
  const draft = currentDraft()
  expect(draft?.source).toBe('pdf')
  expect(draft?.file?.name).toBe('report.pdf')
  expect(draft?.findings[0].bone).toBe('radius')
})

test('pasted text is sent exactly as pasted and treated the same from then on', async () => {
  const pasted = '  EXAM: XR LEFT WRIST\n\nFINDINGS: Radius fracture.  \n'
  render(<AddReportScreen />)
  fireEvent.click(screen.getByLabelText('Paste the text'))
  fireEvent.change(screen.getByLabelText('Report text'), {
    target: { value: pasted },
  })
  submit()
  await waitFor(() =>
    expect(window.location.pathname).toBe('/verify-findings'),
  )
  const [, options] = reader.mock.calls[0] as unknown as [string, RequestInit]
  expect((options.body as FormData).get('text')).toBe(pasted)
  expect(currentDraft()?.source).toBe('pasted')
  expect(currentDraft()?.file).toBeNull()
})

test.each([
  ['not_pdf', "This file isn't a PDF we can open, so it wasn't added."],
  ['too_large', 'This file is over the 10 MB limit, so it wasn’t added.'],
  ['too_many_pages', 'This file has more than 10 pages.'],
  ['no_text', "We couldn't find any text. You can paste the report text."],
])('a %s refusal shows the reader’s message and saves nothing', async (code, message) => {
  reader.mockResolvedValueOnce(jsonResponse({ refusal: code, message }, 422))
  render(<AddReportScreen />)
  choosePdf()
  submit()
  expect((await screen.findByRole('alert')).textContent).toBe(message)
  expect(window.location.pathname).toBe('/add-report')
  expect(currentDraft()).toBeNull()
})

test('an expired sign-in asks the patient to sign in again', async () => {
  reader.mockResolvedValueOnce(jsonResponse({ detail: 'Sign in first.' }, 401))
  render(<AddReportScreen />)
  choosePdf()
  submit()
  expect((await screen.findByRole('alert')).textContent).toContain('sign in')
})

test('a reader it can’t reach says so, and the report can be tried again', async () => {
  reader.mockRejectedValueOnce(new TypeError('network'))
  render(<AddReportScreen />)
  choosePdf()
  submit()
  expect((await screen.findByRole('alert')).textContent).toContain(
    "couldn't reach",
  )
  expect(
    screen.getByRole('button', { name: 'Read my report' }),
  ).toHaveProperty('disabled', false)
})

test('a response in the wrong format never reaches the findings', async () => {
  reader.mockResolvedValueOnce(jsonResponse({ text: 'x', findings: 'nope' }))
  render(<AddReportScreen />)
  choosePdf()
  submit()
  await screen.findByRole('alert')
  expect(currentDraft()).toBeNull()
})

test('says the first read can be slow while the reader wakes', async () => {
  let finish = (_value: Response) => {}
  reader.mockImplementationOnce(
    () => new Promise((resolve) => (finish = resolve)),
  )
  render(<AddReportScreen />)
  choosePdf()
  submit()
  expect((await screen.findByRole('status')).textContent).toContain(
    'up to a minute',
  )
  finish(jsonResponse(b1))
  await waitFor(() =>
    expect(window.location.pathname).toBe('/verify-findings'),
  )
})
