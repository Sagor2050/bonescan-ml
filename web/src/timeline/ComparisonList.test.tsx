import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Suspense } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import catalog from '../../public/shared/bones.json'
import type { Finding } from '../findings/types.ts'
import type { Bone } from '../viewer/bones.ts'
import type { SavedFinding, SavedReport } from '../workspace/reportStore.ts'
import WorkspaceController from '../workspace/WorkspaceController.tsx'
import { comparedReports, comparisonMarkers } from './comparison.ts'
import ComparisonList from './ComparisonList.tsx'

const bones = catalog as unknown as Bone[]

function saved(fields: Partial<Finding>, id: string): SavedFinding {
  return {
    bone: 'radius',
    side: 'left',
    part: [],
    type_words: [],
    certainty: 'certain',
    healing_words: [],
    status: 'placed',
    wording: [],
    entered_by_patient: false,
    id,
    report_id: 'report',
    position: 0,
    ...fields,
  }
}

function report(id: string, date: string, findings: SavedFinding[]): SavedReport {
  return {
    id,
    source: 'pasted',
    file_path: '',
    raw_text: '',
    exam_date: date,
    exam_date_source: 'patient',
    added_at: '2026-09-15T12:00:00Z',
    findings,
  }
}

const comparison = comparedReports(
  [
    report('a', '2026-07-06', [
      saved({ healing_words: ['acute'] }, 'radius-a'),
      saved({ bone: 'femur', side: 'right' }, 'femur-a'),
    ]),
    report('b', '2026-08-17', [
      saved({ healing_words: ['healed'] }, 'radius-b'),
      saved({ bone: 'tibia', side: 'left', certainty: 'uncertain' }, 'tibia-b'),
      saved({ side: '', status: 'side_not_stated' }, 'no-side-b'),
    ]),
  ],
  'a',
  'b',
)!

async function renderList() {
  await act(async () => {
    render(
      <WorkspaceController>
        <Suspense fallback={null}>
          <ComparisonList
            comparison={comparison}
            markers={comparisonMarkers(comparison, bones)}
          />
        </Suspense>
      </WorkspaceController>,
    )
  })
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(catalog) }),
    ),
  )
})

test('groups findings under which reports they are in', async () => {
  await renderList()
  const group = (name: string) => within(screen.getByRole('group', { name }))
  expect(group('In both reports').getByText(/^radius/)).toBeTruthy()
  expect(group('Only in the earlier report').getByText(/^femur/)).toBeTruthy()
  expect(group('Only in the later report').getByText(/^tibia/)).toBeTruthy()
})

test('says which report said what, with no status where it has no words', async () => {
  await renderList()
  const both = within(screen.getByRole('group', { name: 'In both reports' }))
  expect(both.getByText('New: “acute”')).toBeTruthy()
  expect(both.getByText('Healed: “healed”')).toBeTruthy()
  expect(both.getByText('Jul 6, 2026: Fracture')).toBeTruthy()
  expect(both.getByText('Aug 17, 2026: Fracture')).toBeTruthy()

  const later = within(
    screen.getByRole('group', { name: 'Only in the later report' }),
  )
  expect(later.getByText('Aug 17, 2026: Possible fracture')).toBeTruthy()
})

test('a finding with no marker says why', async () => {
  await renderList()
  expect(screen.getByText(/^Side not stated/)).toBeTruthy()
})

test('choosing a row selects it', async () => {
  await renderList()
  const row = screen.getByRole('button', { name: /^femur/ })
  fireEvent.click(row)
  expect(row.getAttribute('aria-pressed')).toBe('true')
})

test('states what the reports list and never judges the change', async () => {
  await renderList()
  const text = screen.getByRole('region', { name: 'Comparison' }).textContent
  expect(text).toMatch(/Ask your care team/)
  expect(text).toMatch(/not how you are healing/)
  expect(text).not.toMatch(
    /better|worse|improv|normal|worsen|recover|progress|resolved|should|new fracture/i,
  )
})
