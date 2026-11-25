import { useCallback, useEffect, useState } from 'react'
import Link from '../routing/Link.tsx'
import { paths } from '../routing/paths.ts'
import { formatExamDate } from '../workspace/examDate.ts'
import ExpirySelect from './ExpirySelect.tsx'
import styles from './Sharing.module.css'
import {
  DEFAULT_EXPIRY_DAYS,
  formatShareDate,
  type ExpiryDays,
  type ShareLink,
  type ShareLinkState,
} from './shareLinks.ts'
import { changeShareLinkExpiry, loadShareLinks, turnOffShareLink } from './shareStore.ts'

const STATE_LABELS: Record<ShareLinkState, string> = {
  active: 'Active',
  expired: 'Expired',
  turned_off: 'Turned off',
}

function ChangeExpiry({
  link,
  onDone,
  onCancel,
}: {
  link: ShareLink
  onDone: () => void
  onCancel: () => void
}) {
  const [days, setDays] = useState<ExpiryDays>(DEFAULT_EXPIRY_DAYS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    setBusy(true)
    try {
      await changeShareLinkExpiry(link.id, days)
      onDone()
    } catch (problem) {
      setError((problem as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className={styles.inline}>
      <ExpirySelect
        id={`expiry-${link.id}`}
        label="Stops working after, from today"
        value={days}
        onChange={setDays}
        disabled={busy}
      />
      {days === null && (
        <p className={styles.notice} role="note">
          <strong>This link will never expire.</strong> It keeps working until you
          turn it off.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}>
        <button type="button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn-primary" disabled={busy} onClick={save}>
          Save expiry
        </button>
      </div>
    </div>
  )
}

function TurnOff({
  link,
  onDone,
  onCancel,
}: {
  link: ShareLink
  onDone: () => void
  onCancel: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function turnOff() {
    setError('')
    setBusy(true)
    try {
      await turnOffShareLink(link.id)
      onDone()
    } catch (problem) {
      setError((problem as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className={`${styles.inline} ${styles.danger}`}>
      <p>
        <strong>Turn off this link?</strong> It stops working right away for
        everyone who has it. You can't turn it back on, but you can make a new link.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}>
        <button type="button" disabled={busy} onClick={onCancel}>
          Keep it on
        </button>
        <button type="button" className="btn-danger" disabled={busy} onClick={turnOff}>
          {busy ? 'Turning off…' : 'Yes, turn it off'}
        </button>
      </div>
    </div>
  )
}

function LinkRow({ link, onChanged }: { link: ShareLink; onChanged: () => void }) {
  const [action, setAction] = useState<'none' | 'expiry' | 'turn-off'>('none')
  const done = () => {
    setAction('none')
    onChanged()
  }
  const cancel = () => setAction('none')
  const reportDates = link.reports.map((report) => formatExamDate(report.examDate))

  return (
    <li className={styles.linkRow}>
      <dl className={styles.facts}>
        <div>
          <dt>Reports</dt>
          <dd>
            {reportDates.length > 0 ? reportDates.join(', ') : 'None left. They were deleted.'}
          </dd>
        </div>
        <div>
          <dt>Made</dt>
          <dd>{formatShareDate(link.createdAt)}</dd>
        </div>
        <div>
          <dt>Expires</dt>
          <dd>{link.expiresAt ? formatShareDate(link.expiresAt) : 'Never'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={`${styles.state} ${styles[link.state]}`}>
              {STATE_LABELS[link.state]}
            </span>
          </dd>
        </div>
      </dl>
      {link.state !== 'turned_off' && action === 'none' && (
        <div className={styles.actions}>
          {link.reports.length > 0 && (
            <button type="button" onClick={() => setAction('expiry')}>
              Change expiry
            </button>
          )}
          <button
            type="button"
            className="btn-danger-outline"
            onClick={() => setAction('turn-off')}
          >
            Turn off
          </button>
        </div>
      )}
      {action === 'expiry' && <ChangeExpiry link={link} onDone={done} onCancel={cancel} />}
      {action === 'turn-off' && <TurnOff link={link} onDone={done} onCancel={cancel} />}
    </li>
  )
}

// Every link the patient has made, with what each covers and whether it still
// works (S10.1). The links' addresses can't be shown again.
function SharedLinksScreen() {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'failed' } | { status: 'ready'; links: ShareLink[] }
  >({ status: 'loading' })

  const load = useCallback(() => {
    loadShareLinks().then(
      (links) => setState({ status: 'ready', links }),
      () => setState({ status: 'failed' }),
    )
  }, [])

  useEffect(load, [load])

  return (
    <main className={styles.screen}>
      <p className={styles.back}>
        <Link href={paths.account}>Account</Link>
      </p>
      <h1>Shared links</h1>
      <p className={styles.lead}>
        Anyone who has an active link can view the reports it covers. For your
        privacy, a link's address can't be shown again. To share again, make a new
        link.
      </p>
      <p>
        <Link className="btn btn-primary" href={paths.shareReports}>
          Share reports
        </Link>
      </p>
      {state.status === 'loading' && <p className="page-message">Loading your links…</p>}
      {state.status === 'failed' && (
        <p className="page-message">We couldn't load your links. Please try again.</p>
      )}
      {state.status === 'ready' && state.links.length === 0 && (
        <p className="page-message">You haven't made any links yet.</p>
      )}
      {state.status === 'ready' && state.links.length > 0 && (
        <ul className={styles.links} aria-label="Your shared links">
          {state.links.map((link) => (
            <LinkRow key={link.id} link={link} onChanged={load} />
          ))}
        </ul>
      )}
    </main>
  )
}

export default SharedLinksScreen
