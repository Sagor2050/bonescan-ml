import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { SavedReport } from '../workspace/reportStore.ts'
import ReportPane from './ReportPane.tsx'

const pasted: SavedReport = {
  id: 'report-1',
  source: 'pasted',
  file_path: '',
  raw_text: 'EXAM: XR WRIST LEFT\n\n  FINDINGS: Fictional text.',
  exam_date: '2026-09-14',
  exam_date_source: 'report',
  added_at: '2026-09-15T12:00:00Z',
  findings: [],
}

test('shows pasted text exactly as added, with its spaces and line breaks', () => {
  render(<ReportPane report={pasted} />)
  const pane = screen.getByRole('region', { name: 'Your original report' })
  expect(pane.querySelector('pre')?.textContent).toBe(pasted.raw_text)
})

test('keeps the app’s own heading outside the report', () => {
  render(<ReportPane report={pasted} />)
  const heading = screen.getByRole('heading', { name: 'Your original report' })
  expect(heading.closest('pre')).toBeNull()
})
