import { useState, type SubmitEvent } from 'react'
import { paths } from '../routing/paths.ts'
import { navigate } from '../routing/router.ts'
import { UploadIcon } from '../ui/icons.tsx'
import Steps from '../ui/Steps.tsx'
import styles from './AddReportScreen.module.css'
import { draftFromReader, setDraftReport } from './draftReport.ts'
import { readReport } from './reader.ts'

type Mode = 'pdf' | 'text'

// Plan A.3. The reader checks the file and proposes findings. Nothing is saved
// here, because the patient hasn't confirmed anything yet (Plan B.3).
function AddReportScreen() {
  const [mode, setMode] = useState<Mode>('pdf')
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [reading, setReading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const ready = mode === 'pdf' ? file !== null : text.trim() !== ''

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready) return
    setReading(true)
    setProblem(null)
    const result = await readReport(
      mode === 'pdf' && file ? { file } : { text },
    )
    if (result.kind === 'read') {
      setDraftReport(
        draftFromReader(
          result.response,
          mode === 'pdf' && file ? { file } : { pasted: true },
        ),
      )
      navigate(paths.verifyFindings)
      return
    }
    setProblem(
      result.kind === 'refused' ? result.refusal.message : result.message,
    )
    setReading(false)
  }

  return (
    <main className={styles.screen}>
      <Steps current={1} />
      <h1>Add a report</h1>
      <p className={styles.lead}>
        Add your imaging report as a PDF or paste its text. You'll check what we
        find before anything is saved.
      </p>

      <form className={styles.card} onSubmit={handleSubmit}>
        <fieldset className={styles.modes}>
          <legend className="visually-hidden">
            How would you like to add it?
          </legend>
          <label>
            <input
              type="radio"
              name="mode"
              checked={mode === 'pdf'}
              onChange={() => setMode('pdf')}
            />
            <span>Upload a PDF</span>
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              checked={mode === 'text'}
              onChange={() => setMode('text')}
            />
            <span>Paste the text</span>
          </label>
        </fieldset>

        {mode === 'pdf' ? (
          <div
            className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`}
          >
            {/* The browser's own file input covers the box, so clicking and
                dropping a file both work, and it stays usable by keyboard. */}
            <input
              type="file"
              accept=".pdf,application/pdf"
              aria-label="PDF file (up to 10 MB and 10 pages)"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              onDragEnter={() => setDragging(true)}
              onDragLeave={() => setDragging(false)}
              onDrop={() => setDragging(false)}
            />
            <UploadIcon />
            <strong>{file ? file.name : 'Choose a PDF file'}</strong>
            <span>
              {file
                ? 'Click to choose a different file.'
                : 'Or drag it here. Up to 10 MB and 10 pages.'}
            </span>
          </div>
        ) : (
          <label className={styles.field}>
            Report text
            <textarea
              rows={12}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
        )}

        {problem && (
          <p className={styles.problem} role="alert">
            {problem}
          </p>
        )}
        {reading && (
          <p className={styles.reading} role="status">
            Reading your report. This can take up to a minute the first time.
          </p>
        )}

        <button
          type="submit"
          className="btn-primary btn-large"
          disabled={!ready || reading}
        >
          Read my report
        </button>
      </form>
    </main>
  )
}

export default AddReportScreen
