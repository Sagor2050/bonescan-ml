import type { Box, Finding } from '../findings/types.ts'
import { isPdfWording } from '../findings/types.ts'

type HighlightSource = Pick<Finding, 'wording'> & { id: string }

export type PageHighlight = {
  findingId: string
  box: Box
  text: string
}

// The boxes to draw over one page of a PDF. They sit on top of the page and
// never change it (NFR4).
export function pageHighlights(
  findings: HighlightSource[],
  pageNumber: number,
): PageHighlight[] {
  return findings.flatMap((finding) =>
    finding.wording.flatMap((wording) =>
      isPdfWording(wording) && wording.page === pageNumber
        ? wording.boxes.map((box) => ({
            findingId: finding.id,
            box,
            text: wording.text,
          }))
        : [],
    ),
  )
}

export type TextSegment = { text: string; findingId: string | null }

// Cuts pasted text into plain pieces and pieces that produced a finding. Joining
// the pieces always gives back the exact text (NFR4). If two findings claim the
// same words, the first one keeps them.
export function textSegments(
  text: string,
  findings: HighlightSource[],
): TextSegment[] {
  const ranges = findings
    .flatMap((finding) =>
      finding.wording.flatMap((wording) =>
        isPdfWording(wording)
          ? []
          : [{ start: wording.start, end: wording.end, findingId: finding.id }],
      ),
    )
    .filter(({ start, end }) => start >= 0 && end <= text.length && start < end)
    .sort((a, b) => a.start - b.start)

  const segments: TextSegment[] = []
  let at = 0
  for (const { start, end, findingId } of ranges) {
    if (start < at) continue
    if (start > at) segments.push({ text: text.slice(at, start), findingId: null })
    segments.push({ text: text.slice(start, end), findingId })
    at = end
  }
  if (at < text.length) segments.push({ text: text.slice(at), findingId: null })
  return segments
}
