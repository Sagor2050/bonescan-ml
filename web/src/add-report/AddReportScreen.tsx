import { useState, type SubmitEvent } from 'react'
import { paths } from '../routing/paths.ts'
import { navigate } from '../routing/router.ts'
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
      <h1>Add a report</h1>
      <p>
        Add your imaging report as a PDF or paste its text. You'll check what we
        find before anything is saved.
      </p>

      <form onSubmit={handleSubmit}>
        <fieldset className={styles.modes}>
          <legend>How would you like to add it?</legend>
          <label>
            <input
              type="radio"
              name="mode"
              checked={mode === 'pdf'}
              onChange={() => setMode('pdf')}
            />
            Upload a PDF
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              checked={mode === 'text'}
              onChange={() => setMode('text')}
            />
            Paste the text
          </label>
        </fieldset>

        {mode === 'pdf' ? (
          <label className={styles.field}>
            PDF file (up to 10 MB and 10 pages)
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
        ) : (
          <label className={styles.field}>
            Report text
            <textarea
              rows={14}
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
          <p role="status">
            Reading your report. This can take up to a minute the first time.
          </p>
        )}

        <button
          type="submit"
          className={styles.primary}
          disabled={!ready || reading}
        >
          Read my report
        </button>
      </form>
    </main>
  )
}

export default AddReportScreen
