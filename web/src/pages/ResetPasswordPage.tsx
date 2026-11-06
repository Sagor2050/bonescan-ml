import { useState, type SubmitEvent } from 'react'
import { MIN_PASSWORD_LENGTH, setNewPassword } from '../account/auth.ts'
import AuthCard from '../account/AuthCard.tsx'
import styles from '../account/AuthCard.module.css'
import { paths } from '../routing/paths.ts'
import { navigate } from '../routing/router.ts'

// Where the link in a password reset email leads (S6.2).
function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    setBusy(true)
    try {
      await setNewPassword(password)
      navigate(paths.reports, { replace: true })
    } catch (problem) {
      setError((problem as Error).message)
      setBusy(false)
    }
  }

  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={handleSubmit}>
        <label htmlFor="password">New password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={styles.primary} disabled={busy}>
          Save the new password
        </button>
      </form>
    </AuthCard>
  )
}

export default ResetPasswordPage
