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
function isSample(id: string) {
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
