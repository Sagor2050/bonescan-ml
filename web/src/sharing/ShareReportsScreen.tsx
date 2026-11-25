import { Suspense, useEffect, useState, type SubmitEvent } from 'react'
import Link from '../routing/Link.tsx'
import { paths } from '../routing/paths.ts'
import { reportBones } from '../timeline/reportBones.ts'
import { useBones } from '../viewer/bones.ts'
import { formatExamDate } from '../workspace/examDate.ts'
import type { SavedReport } from '../workspace/reportStore.ts'
import { useReports } from '../workspace/useReports.ts'
import ExpirySelect from './ExpirySelect.tsx'
import styles from './Sharing.module.css'
import {
  DEFAULT_EXPIRY_DAYS,
  formatShareDate,
  SHARE_WARNING,
  type ExpiryDays,
  type NewShareLink,
} from './shareLinks.ts'
import { createShareLink, loadDefaultShareExpiry } from './shareStore.ts'

function ReportBones({ report }: { report: SavedReport }) {
  const names = reportBones(report.findings, useBones())
  return <>{names.length > 0 ? names.join(', ') : 'No bones listed'}</>
}

function ReportChoices({
  reports,
  chosen,
  onToggle,
}: {
  reports: SavedReport[]
  chosen: Set<string>
  onToggle: (reportId: string) => void
}) {
  return (
    <fieldset className={styles.choices}>
      <legend>Reports to share</legend>
      {reports.map((report) => (
        <label key={report.id} className={styles.choice}>
          <input
            type="checkbox"
            checked={chosen.has(report.id)}
            onChange={() => onToggle(report.id)}
          />
          <span>
            <strong>{formatExamDate(report.exam_date)}</strong>
            <span className={styles.soft}>
              <Suspense fallback={null}>
                <ReportBones report={report} />
              </Suspense>
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}

function CreatedLink({ link, onAgain }: { link: NewShareLink; onAgain: () => void }) {
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link.url)
      setCopy('copied')
    } catch {
      setCopy('failed')
    }
  }

  return (
    <section className={styles.card} aria-labelledby="link-ready">
      <h2 id="link-ready">Your link is ready</h2>
      <p className={styles.notice}>
        <strong>Copy it now.</strong> We can't show this link again, because we
        don't keep a copy of it. If you lose it, make a new one.
      </p>
      <div className={styles.copyRow}>
        <label htmlFor="share-url" className="visually-hidden">
          Share link
        </label>
        <input
          id="share-url"
          readOnly
          value={link.url}
          onFocus={(event) => event.currentTarget.select()}
        />
        <button type="button" className="btn-primary" onClick={handleCopy}>
          Copy
        </button>
      </div>
      <p role="status" className={styles.soft}>
        {copy === 'copied' && 'Copied.'}
        {copy === 'failed' && "We couldn't copy it. Select the link and copy it yourself."}
      </p>
      <p>
        {link.expiresAt
          ? `It stops working on ${formatShareDate(link.expiresAt)}.`
          : 'It never expires. It works until you turn it off.'}{' '}
        You can change this or turn it off on your{' '}
        <Link href={paths.sharedLinks}>Shared links</Link> page.
      </p>
      <button type="button" onClick={onAgain}>
        Share other reports
      </button>
    </section>
  )
}

function ShareForm({
  reports,
  defaultExpiry,
  onCreated,
}: {
  reports: SavedReport[]
  defaultExpiry: ExpiryDays
  onCreated: (link: NewShareLink) => void
}) {
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [expiry, setExpiry] = useState<ExpiryDays>(defaultExpiry)
  const [understood, setUnderstood] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function toggle(reportId: string) {
    const next = new Set(chosen)
    if (next.has(reportId)) next.delete(reportId)
    else next.add(reportId)
    setChosen(next)
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      // In the order shown, which is exam order.
      const ids = reports.filter((report) => chosen.has(report.id)).map((report) => report.id)
      onCreated(await createShareLink(ids, expiry))
    } catch (problem) {
      setError((problem as Error).message)
      setBusy(false)
    }
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <ReportChoices reports={reports} chosen={chosen} onToggle={toggle} />

      <ExpirySelect id="share-expiry" label="Link stops working after" value={expiry} onChange={setExpiry} />
      {expiry === null && (
        <p className={styles.notice} role="note">
          <strong>This link never expires.</strong> It keeps working until you turn
          it off.
        </p>
      )}

      <div className={styles.warning}>
        <p>
          <strong>Before you share:</strong> {SHARE_WARNING}
        </p>
        <label className={styles.choice}>
          <input
            type="checkbox"
            checked={understood}
            onChange={(event) => setUnderstood(event.target.checked)}
          />
          <span>I understand</span>
        </label>
      </div>

      {error && <p role="alert">{error}</p>}
      <button
        type="submit"
        className="btn-primary"
        disabled={busy || chosen.size === 0 || !understood}
      >
        {busy ? 'Making the link…' : 'Make the link'}
      </button>
      {chosen.size === 0 && <p className={styles.soft}>Choose at least one report.</p>}
    </form>
  )
}

// Making a link to share chosen reports (S10.1).
function ShareReportsScreen() {
  const reports = useReports()
  const [defaultExpiry, setDefaultExpiry] = useState<ExpiryDays | 'loading'>('loading')
  const [created, setCreated] = useState<NewShareLink | null>(null)
  const [round, setRound] = useState(0)

  useEffect(() => {
    let current = true
    loadDefaultShareExpiry().then(
      (days) => current && setDefaultExpiry(days),
      () => current && setDefaultExpiry(DEFAULT_EXPIRY_DAYS),
    )
    return () => {
      current = false
    }
  }, [])

  return (
    <main className={styles.screen}>
      <h1>Share reports</h1>
      <p className={styles.lead}>
        Make a link for a family member or caretaker. They don't need an account.
      </p>
      {created ? (
        <CreatedLink
          link={created}
          onAgain={() => {
            setCreated(null)
            setRound(round + 1)
          }}
        />
      ) : reports.status === 'loading' || defaultExpiry === 'loading' ? (
        <p className="page-message">Loading your reports…</p>
      ) : reports.status === 'failed' ? (
        <p className="page-message">We couldn't load your reports. Please try again.</p>
      ) : reports.reports.length === 0 ? (
        <div className={styles.card}>
          <p>You have no reports to share yet.</p>
          <Link className="btn btn-primary" href={paths.addReport}>
            Add a report
          </Link>
        </div>
      ) : (
        <ShareForm
          key={round}
          reports={reports.reports}
          defaultExpiry={defaultExpiry}
          onCreated={setCreated}
        />
      )}
    </main>
  )
}

export default ShareReportsScreen
