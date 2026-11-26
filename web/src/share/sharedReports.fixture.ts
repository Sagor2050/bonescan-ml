import b1 from '../../../tests/fixtures/read-b1-pasted.json'
import b2 from '../../../tests/fixtures/read-b2-pasted.json'

// What GET /api/shared/:token might send for a link to the two fictional
// Appendix B reports, with fields added that the server must never send. The
// page has to drop them. Tests only.

export const TOKEN = 'QSBmaWN0aW9uYWwgc2hhcmUgbGluayBmb3IgdGVzdHM'

export const OWNER_ID = '7d4c2f9e-0a3b-4e51-9c1d-2f6e8b7a5c40'
export const OWNER_EMAIL = 'owner@example.com'

function sharedReport(
  id: string,
  sample: typeof b1 | typeof b2,
  addedAt: string,
  confirmed = true,
) {
  return {
    id,
    source: 'pasted',
    raw_text: sample.text,
    exam_date: sample.exam_date,
    exam_date_source: 'report',
    added_at: addedAt,
    confirmed,
    file_url: null,
    scan_image_urls: [],
    findings: sample.findings.map((finding, position) => ({
      ...finding,
      id: `${id}-finding-${position + 1}`,
      position,
      report_id: id,
    })),
    user_id: OWNER_ID,
    owner_email: OWNER_EMAIL,
    file_path: `${OWNER_ID}/${id}.pdf`,
  }
}

// B.2 comes first, so the page has to put them in exam order itself.
export function sharedResponse({ b2Confirmed = true } = {}) {
  return {
    owner_user_id: OWNER_ID,
    reports: [
      sharedReport('shared-b2', b2, '2026-10-12T15:00:00Z', b2Confirmed),
      sharedReport('shared-b1', b1, '2026-10-13T15:00:00Z'),
    ],
  }
}
