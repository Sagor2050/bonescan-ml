import b1 from '../../../tests/fixtures/read-b1-pdf.json'
import b2 from '../../../tests/fixtures/read-b2-pdf.json'
import { parseReadResponse } from '../findings/parse.ts'
import type { Finding } from '../findings/types.ts'
import { BONES_URL, type Bone } from '../viewer/bones.ts'
import type { SavedFinding, SavedReport } from './reportStore.ts'

// Fictional reports for development and the end-to-end tests. Nothing here is
// real patient data, and production builds never load this file.

function saved(reportId: string, findings: Finding[]): SavedFinding[] {
  return findings.map((finding, index) => ({
    ...finding,
    id: `${reportId}-finding-${index + 1}`,
    report_id: reportId,
  }))
}

function appendixReport(
  id: string,
  sample: unknown,
  addedAt: string,
): SavedReport {
  const response = parseReadResponse(sample)
  return {
    id,
    source: 'pdf',
    file_path: null,
    raw_text: response.text,
    exam_date: response.exam_date ?? '',
    exam_date_source: 'report',
    added_at: addedAt,
    findings: saved(id, response.findings),
  }
}

function handWrittenReport(id: string, findings: Finding[]): SavedReport {
  return {
    id,
    source: 'pasted',
    file_path: null,
    raw_text: 'A fictional report for testing.',
    exam_date: '2026-09-14',
    exam_date_source: 'patient',
    added_at: '2026-09-15T12:00:00Z',
    findings: saved(id, findings),
  }
}

const finding = (fields: Partial<Finding>): Finding => ({
  bone: 'radius',
  side: 'left',
  part: [],
  type_words: [],
  certainty: 'certain',
  healing_words: [],
  status: 'placed',
  wording: [],
  entered_by_patient: false,
  ...fields,
})

async function allBonesReport(id: string) {
  const response = await fetch(BONES_URL)
  const bones = (await response.json()) as Bone[]
  return handWrittenReport(
    id,
    bones.map((bone) => finding({ bone: bone.bone, side: bone.side })),
  )
}

export async function loadSampleReport(
  id: string,
): Promise<SavedReport | null> {
  switch (id) {
    case 'sample-b1':
      return appendixReport(id, b1, '2026-09-15T12:00:00Z')
    case 'sample-b2':
      return appendixReport(id, b2, '2026-10-13T12:00:00Z')
    case 'sample-mixed':
      return handWrittenReport(id, [
        finding({ bone: 'femur', side: 'right', part: ['neck'] }),
        finding({
          bone: 'tibia',
          side: 'left',
          part: ['shaft'],
          certainty: 'uncertain',
        }),
        finding({ bone: 'humerus', side: 'left' }),
        finding({
          bone: 'fibula',
          side: 'right',
          part: ['distal'],
          entered_by_patient: true,
        }),
        finding({ bone: 'radius', side: '', status: 'side_not_stated' }),
      ])
    case 'sample-all-bones':
      return allBonesReport(id)
    default:
      return null
  }
}
