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

const { loadReport, loadReportPdf } = await import('./reportStore.ts')

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
