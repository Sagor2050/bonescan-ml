import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, test } from 'vitest'
import b1 from '../../../tests/fixtures/read-b1-pdf.json'
import { parseReadResponse } from '../findings/parse.ts'
import { draftFromReader } from './draftReport.ts'
import { saveReport } from './saveReport.ts'

const USER_ID = '00000000-0000-0000-0000-000000000abc'
const choice = { examDate: '2026-09-14', source: 'report' as const }

// A stand-in for the parts of Supabase that saving uses, recording each step.
function fakeClient(failing?: 'upload' | 'reports' | 'findings') {
  const steps: string[] = []
  const inserted: Record<string, unknown> = {}
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: USER_ID } }, error: null }),
    },
    storage: {
      from: () => ({
        upload: async (path: string) => {
          steps.push(`upload ${path}`)
          return { error: failing === 'upload' ? new Error('no') : null }
        },
        remove: async ([path]: string[]) => {
          steps.push(`remove ${path}`)
          return { error: null }
        },
      }),
    },
    from: (table: string) => ({
      insert: async (rows: unknown) => {
        steps.push(`insert ${table}`)
        inserted[table] = rows
        return { error: failing === table ? new Error('no') : null }
      },
      delete: () => ({
        eq: async () => {
          steps.push(`delete ${table}`)
          return { error: null }
        },
      }),
    }),
  }
  return { client: client as unknown as SupabaseClient, steps, inserted }
}

const file = new File(['%PDF-'], 'report.pdf', { type: 'application/pdf' })
const pdfDraft = () => draftFromReader(parseReadResponse(b1), { file })

describe('saveReport', () => {
  test('saves the file, then the report, then its findings', async () => {
    const { client, steps, inserted } = fakeClient()
    const id = await saveReport(pdfDraft(), choice, client)

    expect(steps).toEqual([
      `upload ${USER_ID}/${id}.pdf`,
      'insert reports',
      'insert findings',
    ])
    expect(inserted.reports).toMatchObject({
      id,
      source: 'pdf',
      file_path: `${USER_ID}/${id}.pdf`,
      raw_text: b1.text,
      exam_date: '2026-09-14',
      exam_date_source: 'report',
    })
    const [finding] = inserted.findings as Record<string, unknown>[]
    expect(finding).toMatchObject({
      report_id: id,
      position: 0,
      bone: 'radius',
      side: 'left',
    })
    expect(finding).not.toHaveProperty('key')
  })

  test('a pasted report has no file', async () => {
    const { client, steps, inserted } = fakeClient()
    const draft = draftFromReader(parseReadResponse(b1), { pasted: true })
    await saveReport(draft, choice, client)
    expect(steps).toEqual(['insert reports', 'insert findings'])
    expect(inserted.reports).toMatchObject({ source: 'pasted', file_path: '' })
  })

  test('a report with no findings still saves', async () => {
    const { client, steps } = fakeClient()
    await saveReport({ ...pdfDraft(), findings: [] }, choice, client)
    expect(steps.at(-1)).toBe('insert reports')
  })

  test('nothing more is saved when the file upload fails', async () => {
    const { client, steps } = fakeClient('upload')
    await expect(saveReport(pdfDraft(), choice, client)).rejects.toThrow()
    expect(steps).toHaveLength(1)
  })

  test.each(['reports', 'findings'] as const)(
    'everything is undone when saving %s fails',
    async (failing) => {
      const { client, steps } = fakeClient(failing)
      await expect(saveReport(pdfDraft(), choice, client)).rejects.toThrow()
      expect(steps.slice(-2)[0]).toBe('delete reports')
      expect(steps.at(-1)).toMatch(/^remove /)
    },
  )

  test('needs a signed-in user', async () => {
    const client = {
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    } as unknown as SupabaseClient
    await expect(saveReport(pdfDraft(), choice, client)).rejects.toThrow(
      'Sign in',
    )
  })

  test('says so when saving is not set up', async () => {
    await expect(saveReport(pdfDraft(), choice, null)).rejects.toThrow(
      'not set up',
    )
  })
})
