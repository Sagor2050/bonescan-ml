import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const REPORT_ID = '11111111-2222-3333-4444-555555555555'

const mocks = vi.hoisted(() => {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    maybeSingle: vi.fn(),
  }
  const download = vi.fn()
  return {
    query,
    download,
    from: vi.fn(() => query),
    storageFrom: vi.fn(() => ({ download })),
  }
})

vi.mock('../account/supabase.ts', () => ({
  REPORTS_BUCKET: 'reports',
  supabase: {
    from: mocks.from,
    storage: { from: mocks.storageFrom },
  },
}))

const { deleteReport, inExamOrder, loadReport, loadReportPdf } = await import(
  './reportStore.ts'
)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loadReport', () => {
  test('reads the report with its findings in the report’s order', async () => {
    const row = { id: REPORT_ID, findings: [] }
    mocks.query.maybeSingle.mockResolvedValue({ data: row, error: null })

    await expect(loadReport(REPORT_ID)).resolves.toBe(row)

    expect(mocks.from).toHaveBeenCalledWith('reports')
    expect(mocks.query.select).toHaveBeenCalledWith('*, findings(*)')
    expect(mocks.query.eq).toHaveBeenCalledWith('id', REPORT_ID)
    expect(mocks.query.order).toHaveBeenCalledWith('position', {
      referencedTable: 'findings',
    })
  })

  test('gives null for a report the account can’t see', async () => {
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(loadReport(REPORT_ID)).resolves.toBeNull()
  })

  test('throws when the database fails', async () => {
    mocks.query.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'failed' },
    })
    await expect(loadReport(REPORT_ID)).rejects.toThrow()
  })

  test('gives null for an id that can’t be a report, without asking', async () => {
    await expect(loadReport('not-a-report')).resolves.toBeNull()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  test('development samples never reach the database', async () => {
    const report = await loadReport('sample-b1-pasted')
    expect(report?.findings).toHaveLength(1)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

describe('loadReportPdf', () => {
  const report = {
    id: REPORT_ID,
    file_path: `user-1/${REPORT_ID}.pdf`,
  } as Parameters<typeof loadReportPdf>[0]

  test('downloads the original file from the reports bucket', async () => {
    const bytes = new ArrayBuffer(4)
    mocks.download.mockResolvedValue({
      data: { arrayBuffer: () => Promise.resolve(bytes) },
      error: null,
    })

    await expect(loadReportPdf(report)).resolves.toBe(bytes)

    expect(mocks.storageFrom).toHaveBeenCalledWith('reports')
    expect(mocks.download).toHaveBeenCalledWith(report.file_path)
  })

  test('throws when the file can’t be downloaded', async () => {
    mocks.download.mockResolvedValue({
      data: null,
      error: { message: 'failed' },
    })
    await expect(loadReportPdf(report)).rejects.toThrow()
  })
})

describe('inExamOrder', () => {
  const report = (id: string, exam_date: string, added_at: string) =>
    ({ id, exam_date, added_at }) as Parameters<typeof inExamOrder>[0][number]
  const ids = (reports: Parameters<typeof inExamOrder>[0]) =>
    reports.map((one) => one.id)

  test('lists the oldest exam first, whichever was added first', () => {
    const first = report('first', '2026-09-14', '2026-10-14T00:00:00Z')
    const second = report('second', '2026-10-12', '2026-10-13T00:00:00Z')
    expect(ids(inExamOrder([first, second]))).toEqual(['first', 'second'])
    expect(ids(inExamOrder([second, first]))).toEqual(['first', 'second'])
  })

  test('a report added later with an earlier exam takes its place', () => {
    const middle = report('middle', '2026-09-14', '2026-09-15T00:00:00Z')
    const last = report('last', '2026-10-12', '2026-10-13T00:00:00Z')
    const added = report('added-later', '2026-08-01', '2026-11-01T00:00:00Z')
    expect(ids(inExamOrder([middle, last, added]))).toEqual([
      'added-later',
      'middle',
      'last',
    ])
  })

  test('reports with the same exam date keep the order they were added', () => {
    const one = report('one', '2026-09-14', '2026-09-15T00:00:00Z')
    const two = report('two', '2026-09-14', '2026-09-16T00:00:00Z')
    expect(ids(inExamOrder([two, one]))).toEqual(['one', 'two'])
  })

  test('leaves the list it was given as it was', () => {
    const later = report('later', '2026-10-12', '2026-10-13T00:00:00Z')
    const earlier = report('earlier', '2026-09-14', '2026-09-15T00:00:00Z')
    const given = [later, earlier]
    inExamOrder(given)
    expect(ids(given)).toEqual(['later', 'earlier'])
  })
})

describe('deleteReport', () => {
  const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  const filePath = `${USER_ID}/${REPORT_ID}.pdf`
  const pdfReport = { id: REPORT_ID, file_path: filePath }
  const pastedReport = { id: REPORT_ID, file_path: '' }

  // Records the order of the calls, because the file has to go before the row.
  function fakeClient({
    removeError = null as unknown,
    left = [] as { name: string }[],
    listError = null as unknown,
    deleted = [{ id: REPORT_ID }] as { id: string }[] | null,
    deleteError = null as unknown,
  } = {}) {
    const calls: string[] = []
    const eq = vi.fn(() => ({
      select: async () => {
        calls.push('delete row')
        return { data: deleted, error: deleteError }
      },
    }))
    const remove = vi.fn(async () => {
      calls.push('remove file')
      return { data: [], error: removeError }
    })
    const list = vi.fn(async () => {
      calls.push('check file')
      return { data: left, error: listError }
    })
    const client = {
      from: vi.fn(() => ({ delete: () => ({ eq }) })),
      storage: { from: vi.fn(() => ({ remove, list })) },
    } as unknown as SupabaseClient
    return { client, calls, eq, remove, list }
  }

  test('removes the file, checks it has gone, then deletes the row', async () => {
    const { client, calls, eq, remove, list } = fakeClient()

    await deleteReport(pdfReport, client)

    expect(calls).toEqual(['remove file', 'check file', 'delete row'])
    expect(remove).toHaveBeenCalledWith([filePath])
    expect(list).toHaveBeenCalledWith(USER_ID, { search: `${REPORT_ID}.pdf` })
    expect(eq).toHaveBeenCalledWith('id', REPORT_ID)
  })

  test('a pasted report has no file to remove', async () => {
    const { client, calls } = fakeClient()

    await deleteReport(pastedReport, client)

    expect(calls).toEqual(['delete row'])
  })

  test('keeps the row when the file can’t be removed', async () => {
    const { client, calls } = fakeClient({ removeError: new Error('down') })

    await expect(deleteReport(pdfReport, client)).rejects.toThrow()

    expect(calls).toEqual(['remove file'])
  })

  test('keeps the row when the file is still there with no error', async () => {
    const { client, calls } = fakeClient({
      left: [{ name: `${REPORT_ID}.pdf` }],
    })

    await expect(deleteReport(pdfReport, client)).rejects.toThrow()

    expect(calls).not.toContain('delete row')
  })

  test('keeps the row when it can’t check the file', async () => {
    const { client, calls } = fakeClient({ listError: new Error('down') })

    await expect(deleteReport(pdfReport, client)).rejects.toThrow()

    expect(calls).not.toContain('delete row')
  })

  test('fails when the database deleted nothing', async () => {
    const { client } = fakeClient({ deleted: [] })

    await expect(deleteReport(pastedReport, client)).rejects.toThrow()
  })

  test('fails when the database refuses', async () => {
    const { client } = fakeClient({ deleted: null, deleteError: new Error('no') })

    await expect(deleteReport(pastedReport, client)).rejects.toThrow()
  })

  test('fails when accounts aren’t set up', async () => {
    await expect(deleteReport(pastedReport, null)).rejects.toThrow()
  })
})
