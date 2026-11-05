import { useSyncExternalStore } from 'react'
import type { Finding, ReadResponse } from '../findings/types.ts'

// A report the patient hasn't confirmed yet (Plan B.3: Unconfirmed). It lives only
// in this browser tab's memory. Nothing is saved until the patient confirms.

export type DraftFinding = Finding & { key: string }

export type DraftReport = {
  source: 'pdf' | 'pasted'
  file: File | null
  text: string
  readerExamDate: string | null
  candidateDates: string[]
  findings: DraftFinding[]
}

let draft: DraftReport | null = null
const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

export function useDraftReport() {
  return useSyncExternalStore(subscribe, () => draft)
}

export function setDraftReport(next: DraftReport | null) {
  draft = next
  listeners.forEach((listener) => listener())
}

export function newFindingKey() {
  return crypto.randomUUID()
}

/** Start a draft from what the reader proposed. */
export function draftFromReader(
  response: ReadResponse,
  source: { file: File } | { pasted: true },
): DraftReport {
  return {
    source: 'file' in source ? 'pdf' : 'pasted',
    file: 'file' in source ? source.file : null,
    text: response.text,
    readerExamDate: response.exam_date,
    candidateDates: response.candidate_dates,
    findings: response.findings.map((finding) => ({
      ...finding,
      key: newFindingKey(),
    })),
  }
}
