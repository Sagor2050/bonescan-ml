import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
} from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useEffect, useRef, useState } from 'react'
import { loadReportPdf, type SavedReport } from '../workspace/reportStore.ts'
import { useWorkspace } from '../workspace/workspaceState.ts'
import { pageHighlights, type PageHighlight } from './highlights.ts'
import styles from './PdfReport.module.css'

GlobalWorkerOptions.workerSrc = workerUrl

// Space between a page and the edges of the pane.
const PAGE_MARGIN = 16

function PdfPage({
  pdf,
  pageNumber,
  width,
  highlights,
}: {
  pdf: PDFDocumentProxy
  pageNumber: number
  width: number
  highlights: PageHighlight[]
}) {
  const { selectedFindingId, selectFinding } = useWorkspace()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawn, setDrawn] = useState(false)
  const [scale, setScale] = useState<number | null>(null)

  useEffect(() => {
    const draw: { cancelled: boolean; task?: { cancel: () => void } } = {
      cancelled: false,
    }

    pdf
      .getPage(pageNumber)
      .then((page) => {
        const canvas = canvasRef.current
        if (draw.cancelled || !canvas) return

        const nextScale = width / page.getViewport({ scale: 1 }).width
        const viewport = page.getViewport({ scale: nextScale })
        setScale(nextScale)
        // Draws at the screen's real pixel size, so the text stays sharp.
        const pixelRatio = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * pixelRatio)
        canvas.height = Math.floor(viewport.height * pixelRatio)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`

        const task = page.render({
          canvas,
          viewport,
          transform:
            pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        })
        draw.task = task
        return task.promise.then(() => {
          if (!draw.cancelled) setDrawn(true)
        })
      })
      .catch(() => {
        // Cancelled because the pane changed size. A new draw is on its way.
      })

    return () => {
      draw.cancelled = true
      draw.task?.cancel()
    }
  }, [pdf, pageNumber, width])

  return (
    <div className={styles.page} data-page={pageNumber} data-drawn={drawn}>
      <canvas ref={canvasRef} role="img" aria-label={`Page ${pageNumber}`} />
      {scale !== null &&
        highlights.map(({ findingId, box, text }, index) => {
          const [x0, top, x1, bottom] = box
          return (
            <button
              key={index}
              className={styles.highlight}
              data-finding={findingId}
              aria-label={`Show on the model: ${text}`}
              aria-pressed={findingId === selectedFindingId}
              style={{
                left: x0 * scale,
                top: top * scale,
                width: (x1 - x0) * scale,
                height: (bottom - top) * scale,
              }}
              onClick={() => selectFinding(findingId)}
            />
          )
        })}
    </div>
  )
}

// Shows every page with PDF.js, in a column that scrolls within the pane (S4.1).
function PdfReport({ report }: { report: SavedReport }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [failed, setFailed] = useState(false)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    let cancelled = false
    const loading: { task?: ReturnType<typeof getDocument> } = {}

    loadReportPdf(report)
      .then((bytes) => {
        if (cancelled) return
        // PDF.js takes over the bytes it is given, so it gets a copy.
        loading.task = getDocument({ data: bytes.slice(0) })
        return loading.task.promise
      })
      .then((document) => {
        if (document && !cancelled) setPdf(document)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
      void loading.task?.destroy()
      setPdf(null)
    }
  }, [report])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => {
      const available = container.clientWidth - PAGE_MARGIN * 2
      // A hidden pane has no width. Keep the pages as they are.
      if (available > 0) setWidth(available)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  if (failed) {
    return (
      <p className={styles.message}>
        We couldn't show your original report. Please try again.
      </p>
    )
  }

  return (
    <div ref={containerRef} className={styles.pages}>
      {pdf && width > 0
        ? Array.from({ length: pdf.numPages }, (_page, index) => (
            <PdfPage
              key={index}
              pdf={pdf}
              pageNumber={index + 1}
              width={width}
              highlights={pageHighlights(report.findings, index + 1)}
            />
          ))
        : <p className={styles.message}>Loading your report…</p>}
    </div>
  )
}

export default PdfReport
