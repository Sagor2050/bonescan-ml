import { createClient } from '@supabase/supabase-js'
import type { ShareStore, StoredReport } from './sharedReports.js'

const REPORTS_BUCKET = 'reports'

// Reads shared reports with the service-role key, which row-level security
// doesn't limit. That's why this only reads, only after the link is checked by
// the database's own share_link_is_active, and only the link's reports. The key
// lives in the Vercel project's settings and never reaches a browser.
export function supabaseShareStore(): ShareStore {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set.')
  }
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return {
    async activeLinkId(token) {
      // The one way to hash a token, so both sides of a link agree (#124).
      const hashed = await db.rpc('share_token_hash', { token })
      if (hashed.error) throw hashed.error

      const link = await db
        .from('share_links')
        .select('id')
        .eq('token_hash', hashed.data as string)
        .maybeSingle()
      if (link.error) throw link.error
      if (!link.data) return null

      const active = await db.rpc('share_link_is_active', {
        link_id: link.data.id,
      })
      if (active.error) throw active.error
      return active.data === true ? (link.data.id as string) : null
    },

    async linkedReports(linkId) {
      const covered = await db
        .from('share_link_reports')
        .select('report_id')
        .eq('share_link_id', linkId)
      if (covered.error) throw covered.error
      const ids = covered.data.map((row) => row.report_id as string)
      if (ids.length === 0) return []

      const reports = await db
        .from('reports')
        .select(
          'id, source, file_path, raw_text, exam_date, exam_date_source, added_at, findings(*)',
        )
        .in('id', ids)
        .order('position', { referencedTable: 'findings' })
      if (reports.error) throw reports.error
      return reports.data as unknown as StoredReport[]
    },

    async downloadFile(filePath) {
      const file = await db.storage.from(REPORTS_BUCKET).download(filePath)
      if (file.error) return null
      return file.data.arrayBuffer()
    },
  }
}
