import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, test } from 'vitest'
import type { DraftFinding } from '../add-report/draftReport.ts'
import { editFinding, newFinding } from '../add-report/findingEdits.ts'
import type { Finding } from '../findings/types.ts'
import {
  findingChanges,
  saveReportChanges,
  type SavedFinding,
  type SavedReport,
} from './reportStore.ts'

const REPORT = '00000000-0000-0000-0000-000000000001'

function saved(id: string, position: number, fields: Partial<Finding> = {}) {
  return {
    bone: 'radius',
    side: 'left',
    part: ['distal'],
    type_words: ['transverse'],
    certainty: 'certain',
    healing_words: [],
    status: 'placed',
    wording: [{ start: 0, end: 8, text: 'Fracture' }],
    entered_by_patient: false,
    id,
    report_id: REPORT,
    position,
    ...fields,
  } satisfies SavedFinding
}

function inEditor({ id, report_id: _r, position: _p, ...finding }: SavedFinding) {
  return { ...finding, key: id } satisfies DraftFinding
}

function report(findings: SavedFinding[]): SavedReport {
  return {
    id: REPORT,
    source: 'pasted',
    file_path: '',
    raw_text: 'The original report.',
    exam_date: '2026-09-14',
    exam_date_source: 'report',
    added_at: '2026-09-15T12:00:00Z',
    findings,
  }
}

describe('findingChanges', () => {
  const a = saved('a', 0)
  const b = saved('b', 1, { bone: 'femur', side: 'right' })

  test('nothing changed means nothing to write', () => {
    expect(findingChanges(REPORT, [a, b], [a, b].map(inEditor))).toEqual({
      added: [],
      updated: [],
      removed: [],
    })
  })

  test('a correction writes only what changed, and is labeled as the patient’s', () => {
    const edited = editFinding(inEditor(a), { side: 'right' })
    const { updated } = findingChanges(REPORT, [a], [edited])
    expect(updated).toEqual([
      { id: 'a', fields: { side: 'right', entered_by_patient: true } },
    ])
  })

  test('a correction never includes the report’s wording', () => {
    const edited = editFinding(inEditor(a), { bone: 'ulna', part: [] })
    const { updated } = findingChanges(REPORT, [a], [edited])
    expect(updated[0].fields).not.toHaveProperty('wording')
    expect(updated[0].fields).not.toHaveProperty('type_words')
  })

  test('removing a finding moves up the ones after it', () => {
    const { removed, updated } = findingChanges(REPORT, [a, b], [inEditor(b)])
    expect(removed).toEqual(['a'])
    expect(updated).toEqual([{ id: 'b', fields: { position: 0 } }])
  })

  test('a new finding joins the report at the end', () => {
    const { added } = findingChanges(REPORT, [a], [inEditor(a), newFinding()])
    expect(added).toHaveLength(1)
    expect(added[0]).toMatchObject({
      report_id: REPORT,
      position: 1,
      entered_by_patient: true,
    })
    expect(added[0]).not.toHaveProperty('key')
  })
})

// A stand-in for the parts of Supabase that saving uses, recording each write.
function fakeClient({ rows = 1, failOn = '' } = {}) {
  const writes: { table: string; kind: string; values?: unknown; ids?: unknown }[] = []
  const finish = (kind: string, count: number) => {
    const error = failOn === kind ? new Error('no') : null
    return Promise.resolve({
      data: error ? null : Array.from({ length: count }, () => ({ id: 'x' })),
      error,
    })
  }
  const client = {
    from: (table: string) => ({
      insert: (values: unknown) => {
        writes.push({ table, kind: 'insert', values })
        return finish('insert', 1)
      },
      update: (values: unknown) => ({
        eq: () => ({
          select: () => {
            writes.push({ table, kind: 'update', values })
            return finish(`update ${table}`, rows)
          },
        }),
      }),
      delete: () => ({
        in: (_column: string, ids: string[]) => ({
          select: () => {
            writes.push({ table, kind: 'delete', ids })
            return finish('delete', rows === 0 ? 0 : ids.length)
          },
        }),
      }),
    }),
  }
  return { client: client as unknown as SupabaseClient, writes }
}

describe('saveReportChanges', () => {
  const a = saved('a', 0)
  const b = saved('b', 1)

  test('changing the date marks it as the patient’s, and writes nothing else', async () => {
    const { client, writes } = fakeClient()
    await saveReportChanges(
      report([a]),
      { examDate: '2026-10-01', findings: [inEditor(a)] },
      client,
    )
    expect(writes).toEqual([
      {
        table: 'reports',
        kind: 'update',
        values: { exam_date: '2026-10-01', exam_date_source: 'patient' },
      },
    ])
  })

  test('saving with no changes writes nothing', async () => {
    const { client, writes } = fakeClient()
    await saveReportChanges(
      report([a]),
      { examDate: '2026-09-14', findings: [inEditor(a)] },
      client,
    )
    expect(writes).toEqual([])
  })

  test('never writes the original report’s text or file', async () => {
    const { client, writes } = fakeClient()
    await saveReportChanges(
      report([a]),
      {
        examDate: '2026-10-01',
        findings: [editFinding(inEditor(a), { side: 'right' })],
      },
      client,
    )
    const text = JSON.stringify(writes)
    expect(text).not.toContain('raw_text')
    expect(text).not.toContain('file_path')
    expect(text).not.toContain('wording')
  })

  test('adds and changes before removing, so a failure can’t lose a finding', async () => {
    const { client, writes } = fakeClient()
    await saveReportChanges(
      report([a, b]),
      { examDate: '2026-09-14', findings: [inEditor(b), newFinding()] },
      client,
    )
    expect(writes.map((write) => write.kind)).toEqual([
      'insert',
      'update',
      'delete',
    ])
  })

  test.each(['insert', 'update findings', 'delete', 'update reports'])(
    'reports a failed %s',
    async (failOn) => {
      const { client } = fakeClient({ failOn })
      await expect(
        saveReportChanges(
          report([a, b]),
          {
            examDate: '2026-10-01',
            findings: [
              editFinding(inEditor(b), { side: 'right' }),
              newFinding(),
            ],
          },
          client,
        ),
      ).rejects.toThrow(/could not all be saved/)
    },
  )

  test('a write the access rules stopped counts as a failure', async () => {
    const { client } = fakeClient({ rows: 0 })
    await expect(
      saveReportChanges(
        report([a]),
        { examDate: '2026-10-01', findings: [inEditor(a)] },
        client,
      ),
    ).rejects.toThrow(/could not all be saved/)
  })
})
