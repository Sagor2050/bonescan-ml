import { useState, type SubmitEvent } from 'react'
import styles from './AccountScreen.module.css'
import { deleteAccount } from './auth.ts'
import { useSession } from './session.ts'

// Asks for the password, because deleting the account can't be undone (S6.3).
function DeleteAccount() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open) {
    return (
      <>
        <p className={styles.warning}>
          This deletes your account and every report in it.
        </p>
        <button className="btn-danger-outline" onClick={() => setOpen(true)}>
          Delete my account
        </button>
      </>
    )
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      // On success this leaves for the home page, so nothing more happens here.
      await deleteAccount(password)
    } catch (problem) {
      setError((problem as Error).message)
      setPassword('')
      setBusy(false)
    }
  }

  return (
    <form className={styles.confirm} onSubmit={handleSubmit}>
      <p>
        <strong>Delete your account?</strong> This deletes your account and every
        report in it, with their findings and original files. You can't get them
        back. You'll go back to the home page when it's done.
      </p>
      <label htmlFor="confirm-password">Enter your password to confirm</label>
      <input
        id="confirm-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        autoFocus
      />
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}>
        <button type="button" disabled={busy} onClick={() => setOpen(false)}>
          Keep my account
        </button>
        <button type="submit" className="btn-danger" disabled={busy}>
          {busy ? 'Deleting…' : 'Yes, delete everything'}
        </button>
      </div>
    </form>
  )
}

function AccountScreen() {
  const session = useSession()
  return (
    <main className={styles.screen}>
      <h1>Account</h1>
      {session.status === 'no-accounts' && (
        <p>Accounts aren't set up on this copy of the app.</p>
      )}
      {session.status === 'signed-in' && (
        <>
          <section className={styles.panel}>
            <p className={styles.signedIn}>
              Signed in as <strong>{session.session.user.email}</strong>
            </p>
          </section>
          <section className={styles.panel}>
            <h2>Delete my account</h2>
            <DeleteAccount />
          </section>
        </>
      )}
    </main>
  )
}

export default AccountScreen
