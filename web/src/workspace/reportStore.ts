import type { Finding } from '../findings/types.ts'

// A confirmed report and its findings as the database holds them (Plan B.1).
// Only a confirmed report ever reaches the model (Plan B.3).
export type SavedFinding = Finding & { id: string; report_id: string }

export type SavedReport = {
  id: string
  source: 'pdf' | 'pasted'
  file_path: string | null
  raw_text: string
  exam_date: string
  exam_date_source: 'report' | 'patient'
  added_at: string
  findings: SavedFinding[]
}

// Reading from Supabase joins this file when accounts and saving are ready (#9,
// #33). Until then, only development builds have anything to show: the fictional
// reports in sampleReports.ts, which production builds leave out.
export async function loadReport(id: string): Promise<SavedReport | null> {
  if (!import.meta.env.DEV) return null
  const { loadSampleReport } = await import('./sampleReports.ts')
  return loadSampleReport(id)
}
