import type { SupabaseClient } from '@supabase/supabase-js'
import {
  REPORTS_BUCKET,
  reportFilePath,
  supabase,
} from '../account/supabase.ts'
import type { DraftReport } from './draftReport.ts'

export type ExamDateChoice = {
  examDate: string
  source: 'report' | 'patient'
}

/**
 * Save a confirmed report (Plan B.3: Confirmed): the original file, then the report,
 * then its findings. If any step fails, the earlier ones are undone, so a report is
 * never left half saved. Returns the new report's id.
 */
export async function saveReport(
  draft: DraftReport,
  examDate: ExamDateChoice,
  client: SupabaseClient | null = supabase,
): Promise<string> {
  if (!client) throw new Error('Saving reports is not set up yet.')
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser()
  if (userError || !user) throw new Error('Sign in to save your report.')

  const id = crypto.randomUUID()
  const filePath = draft.file ? reportFilePath(user.id, id) : ''
  const files = client.storage.from(REPORTS_BUCKET)

  if (draft.file) {
    const { error } = await files.upload(filePath, draft.file, {
      contentType: 'application/pdf',
      upsert: false,
    })
    if (error) throw new Error('Your report could not be saved. Please try again.')
  }

  async function undo() {
    await client!.from('reports').delete().eq('id', id)
    if (filePath) await files.remove([filePath])
  }

  const { error: reportError } = await client.from('reports').insert({
    id,
    source: draft.source,
    file_path: filePath,
    raw_text: draft.text,
    exam_date: examDate.examDate,
    exam_date_source: examDate.source,
  })
  if (reportError) {
    await undo()
    throw new Error('Your report could not be saved. Please try again.')
  }

  if (draft.findings.length > 0) {
    const { error: findingsError } = await client.from('findings').insert(
      draft.findings.map(({ key: _key, ...finding }, position) => ({
        ...finding,
        report_id: id,
        position,
      })),
    )
    if (findingsError) {
      await undo()
      throw new Error('Your report could not be saved. Please try again.')
    }
  }
  return id
}
