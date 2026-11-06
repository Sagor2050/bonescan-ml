import b1Pasted from '../../../tests/fixtures/read-b1-pasted.json'
import b1 from '../../../tests/fixtures/read-b1-pdf.json'
import b2Pasted from '../../../tests/fixtures/read-b2-pasted.json'
import b2 from '../../../tests/fixtures/read-b2-pdf.json'
import report1Url from '../../../tests/fixtures/report-b1.pdf?url'
import report2Url from '../../../tests/fixtures/report-b2.pdf?url'
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
    position: index,
  }))
}

function appendixReport(
  id: string,
  sample: unknown,
  addedAt: string,
  filePath = '',
): SavedReport {
  const response = parseReadResponse(sample)
  return {
    id,
    source: filePath ? 'pdf' : 'pasted',
    file_path: filePath,
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
    file_path: '',
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

// A small two-page PDF, for testing that every page can be reached. Each page
// says only its own number.
const TWO_PAGE_PDF = 'two-pages'

function twoPagePdf() {
  const page = (kids: number, text: string) =>
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${kids} 0 R ` +
    `/Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>\n` +
    `% ${text}`
  const stream = (text: string) => {
    const content = `BT /F1 24 Tf 72 700 Td (${text}) Tj ET`
    return `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  }
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    page(4, 'first'),
    stream('Sample page one'),
    page(6, 'second'),
    stream('Sample page two'),
  ]
  const body = objects
    .map((object, index) => `${index + 1} 0 obj\n${object}\nendobj\n`)
    .join('')
  return new TextEncoder().encode(
    `%PDF-1.4\n${body}trailer\n<< /Root 1 0 R /Size 7 >>\n%%EOF\n`,
  ).buffer as ArrayBuffer
}

export async function loadSamplePdf(filePath: string): Promise<ArrayBuffer> {
  if (filePath === TWO_PAGE_PDF) return twoPagePdf()
  const response = await fetch(filePath)
  return response.arrayBuffer()
}

// The timeline's samples. B.2 was added first, to show that order comes from the
// exam date and not from when a report was added.
export async function loadSampleReports() {
  return [
    appendixReport('sample-b2', b2, '2026-10-13T12:00:00Z', report2Url),
    appendixReport('sample-b1', b1, '2026-10-14T12:00:00Z', report1Url),
  ]
}

export async function loadSampleReport(
  id: string,
): Promise<SavedReport | null> {
  switch (id) {
    case 'sample-b1':
      return appendixReport(id, b1, '2026-09-15T12:00:00Z', report1Url)
    case 'sample-b2':
      return appendixReport(id, b2, '2026-10-13T12:00:00Z', report2Url)
    case 'sample-b1-pasted':
      return appendixReport(id, b1Pasted, '2026-09-15T12:00:00Z')
    case 'sample-b2-pasted':
      return appendixReport(id, b2Pasted, '2026-10-13T12:00:00Z')
    case 'sample-two-pages':
      return {
        ...handWrittenReport(id, [
          finding({
            part: ['distal'],
            wording: [
              {
                page: 2,
                boxes: [[72, 70, 260, 98]],
                text: 'Sample page two',
              },
            ],
          }),
        ]),
        source: 'pdf',
        file_path: TWO_PAGE_PDF,
      }
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
