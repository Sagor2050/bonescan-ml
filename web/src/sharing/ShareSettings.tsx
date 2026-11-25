import { useEffect, useState } from 'react'
import Link from '../routing/Link.tsx'
import { paths } from '../routing/paths.ts'
import ExpirySelect from './ExpirySelect.tsx'
import styles from './Sharing.module.css'
import type { ExpiryDays } from './shareLinks.ts'
import { loadDefaultShareExpiry, saveDefaultShareExpiry } from './shareStore.ts'

// The expiry new links start with, and the way to every link made so far (S10.1).
function ShareSettings() {
  const [days, setDays] = useState<ExpiryDays | 'loading' | 'failed'>('loading')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let current = true
    loadDefaultShareExpiry().then(
      (loaded) => current && setDays(loaded),
      () => current && setDays('failed'),
    )
    return () => {
      current = false
    }
  }, [])

  async function change(next: ExpiryDays) {
    const before = days
    setDays(next)
    setMessage('')
    setBusy(true)
    try {
      await saveDefaultShareExpiry(next)
      setMessage('Saved.')
    } catch (problem) {
      setDays(before)
      setMessage((problem as Error).message)
    }
    setBusy(false)
  }

  return (
    <>
      <p className={styles.soft}>
        New links start with this expiry. You can pick a different one each time you
        share.
      </p>
      {days === 'loading' && <p>Loading…</p>}
      {days === 'failed' && <p role="alert">Your sharing settings could not be loaded.</p>}
      {days !== 'loading' && days !== 'failed' && (
        <>
          <ExpirySelect
            id="default-share-expiry"
            label="Default link expiry"
            value={days}
            onChange={change}
            disabled={busy}
          />
          {days === null && (
            <p className={styles.notice} role="note">
              <strong>New links will never expire</strong> unless you pick an expiry.
              They keep working until you turn them off.
            </p>
          )}
        </>
      )}
      <p role="status" className={styles.soft}>
        {message}
      </p>
      <Link href={paths.sharedLinks}>See and manage your shared links</Link>
    </>
  )
}

export default ShareSettings
