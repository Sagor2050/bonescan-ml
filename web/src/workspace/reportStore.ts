import type { SupabaseClient } from '@supabase/supabase-js'
import { REPORTS_BUCKET, supabase } from '../account/supabase.ts'
import type { Finding } from '../findings/types.ts'

// A confirmed report and its findings as the database holds them (Plan B.1).
// Only a confirmed report ever reaches the model (Plan B.3).
export type SavedFinding = Finding & {
  id: string
  report_id: string
  position: number
}

export type SavedReport = {
  id: string
  source: 'pdf' | 'pasted'
  file_path: string
  raw_text: string
  exam_date: string
  exam_date_source: 'report' | 'patient'
  added_at: string
  findings: SavedFinding[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The fictional reports in sampleReports.ts exist only in development. Production
// builds leave them out.
export function isSample(id: string) {
  return import.meta.env.DEV && id.startsWith('sample-')
}

// Row-level security limits these to the signed-in account's own rows (NFR8), so
// the queries don't filter by user.
export async function loadReport(id: string): Promise<SavedReport | null> {
  if (isSample(id)) {
    const { loadSampleReport } = await import('./sampleReports.ts')
    return loadSampleReport(id)
  }
  if (!supabase || !UUID.test(id)) return null

  const { data, error } = await supabase
    .from('reports')
    .select('*, findings(*)')
    .eq('id', id)
    .order('position', { referencedTable: 'findings' })
    .maybeSingle()
  if (error) throw new Error('The report could not be loaded.')
  return data as SavedReport | null
}

// Exam date first, oldest first. Reports with the same exam date keep the order
// they were added (S5.1). The added time is never the main order, so a report
// added later with an earlier exam takes its place by exam date.
export function inExamOrder(reports: SavedReport[]) {
  return [...reports].sort(
    (a, b) =>
      a.exam_date.localeCompare(b.exam_date) ||
      a.added_at.localeCompare(b.added_at),
  )
}

export async function loadReports(): Promise<SavedReport[]> {
  if (!supabase) {
    if (!import.meta.env.DEV) return []
    const { loadSampleReports } = await import('./sampleReports.ts')
    return inExamOrder(await loadSampleReports())
  }

  const { data, error } = await supabase
    .from('reports')
    .select('*, findings(*)')
    .order('exam_date')
    .order('added_at')
    .order('position', { referencedTable: 'findings' })
  if (error) throw new Error('Your reports could not be loaded.')
  return inExamOrder(data as SavedReport[])
}

// The original PDF, exactly as it was added (NFR4).
export async function loadReportPdf(report: SavedReport): Promise<ArrayBuffer> {
  if (isSample(report.id)) {
    const { loadSamplePdf } = await import('./sampleReports.ts')
    return loadSamplePdf(report.file_path)
  }
  if (!supabase) throw new Error('The report could not be loaded.')

  const { data, error } = await supabase.storage
    .from(REPORTS_BUCKET)
    .download(report.file_path)
  if (error) throw new Error('The report could not be loaded.')
  return data.arrayBuffer()
}

// Deletes a report for good (S1.3). The file goes first: if that fails, the row
// is still there to try again from. The other way round could leave the file
// online with nothing pointing to it (NFR10). The database removes the findings
// along with the report.
export async function deleteReport(
  report: Pick<SavedReport, 'id' | 'file_path'>,
  client: SupabaseClient | null = supabase,
): Promise<void> {
  const failed = new Error('The report could not be deleted.')
  if (!client) throw failed

  if (report.file_path) {
    const files = client.storage.from(REPORTS_BUCKET)
    const { error } = await files.remove([report.file_path])
    if (error) throw failed

    // Storage reports no error when the access rules stop a delete, so check
    // that the file has gone.
    const slash = report.file_path.lastIndexOf('/')
    const folder = report.file_path.slice(0, slash)
    const name = report.file_path.slice(slash + 1)
    const { data: left, error: listError } = await files.list(folder, {
      search: name,
    })
    if (listError || left.some((file) => file.name === name)) throw failed
  }

  // The same goes for the row, so count what was deleted.
  const { data, error } = await client
    .from('reports')
    .delete()
    .eq('id', report.id)
    .select('id')
  if (error || data.length === 0) throw failed
}
