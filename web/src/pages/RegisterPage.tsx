import { useEffect, useState, type SubmitEvent } from 'react'
import { createAccount, MIN_PASSWORD_LENGTH } from '../account/auth.ts'
import AuthCard from '../account/AuthCard.tsx'
import styles from '../account/AuthCard.module.css'
import { useSession } from '../account/session.ts'
import Link from '../routing/Link.tsx'
import { paths } from '../routing/paths.ts'
import { navigate } from '../routing/router.ts'

// Plan A.2. It asks for an email address and a password, and nothing else (S6.1).
function RegisterPage() {
  const session = useSession()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (session.status === 'signed-in') {
      navigate(paths.reports, { replace: true })
    }
  }, [session.status])

  async function handleRegister(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    try {
      await createAccount(email, password)
      setSentTo(email)
    } catch (problem) {
      setError((problem as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (sentTo) {
    return (
      <AuthCard title="Check your email">
        <p>We sent a link to confirm your email address to:</p>
        <p className={styles.email}>{sentTo}</p>
        <p>
          Open it to finish creating your account. You can't save reports until
          you do. If this address already has an account, no new one was
          created, and you can <Link href={paths.signIn}>sign in</Link> instead.
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Create account"
      subtitle="We only ask for an email address and a password."
    >
      <form onSubmit={handleRegister}>
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <label htmlFor="confirmPassword">Confirm password</label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button type="submit" className={styles.primary} disabled={busy}>
          Create account
        </button>
      </form>

      <p className={styles.footer}>
        Already have an account? <Link href={paths.signIn}>Sign in</Link>
      </p>
    </AuthCard>
  )
}

export default RegisterPage
