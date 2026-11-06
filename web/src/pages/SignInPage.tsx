import { useEffect, useState, type SubmitEvent } from 'react'
import { requestPasswordReset, signIn } from '../account/auth.ts'
import AuthCard from '../account/AuthCard.tsx'
import styles from '../account/AuthCard.module.css'
import { useSession } from '../account/session.ts'
import Link from '../routing/Link.tsx'
import { paths } from '../routing/paths.ts'
import { navigate } from '../routing/router.ts'

// Plan A.2. A returning patient lands on their timeline.
function SignInPage() {
  const session = useSession()
  const [mode, setMode] = useState<'sign-in' | 'forgot' | 'sent'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (session.status === 'signed-in') {
      navigate(paths.reports, { replace: true })
    }
  }, [session.status])

  async function attempt(action: () => Promise<void>) {
    setError('')
    setBusy(true)
    try {
      await action()
    } catch (problem) {
      setError((problem as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function handleSignIn(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    return attempt(async () => {
      await signIn(email, password)
      navigate(paths.reports, { replace: true })
    })
  }

  function handleForgot(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    return attempt(async () => {
      await requestPasswordReset(email)
      setMode('sent')
    })
  }

  if (mode === 'sent') {
    return (
      <AuthCard title="Check your email">
        <p>
          If <span className={styles.email}>{email}</span> has an account, we
          sent it a link to choose a new password.
        </p>
        <p className={styles.footer}>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => setMode('sign-in')}
          >
            Back to sign in
          </button>
        </p>
      </AuthCard>
    )
  }

  const emailField = (
    <>
      <label htmlFor="email">Email address</label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
    </>
  )
  const problem = error && (
    <p className={styles.error} role="alert">
      {error}
    </p>
  )

  if (mode === 'forgot') {
    return (
      <AuthCard
        title="Choose a new password"
        subtitle="We'll send a link to your confirmed email address."
      >
        <form onSubmit={handleForgot}>
          {emailField}
          {problem}
          <button type="submit" className={styles.primary} disabled={busy}>
            Send the link
          </button>
        </form>
        <p className={styles.footer}>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => setMode('sign-in')}
          >
            Back to sign in
          </button>
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Sign in">
      <form onSubmit={handleSignIn}>
        {emailField}
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {problem}
        <button type="submit" className={styles.primary} disabled={busy}>
          Sign in
        </button>
      </form>
      <p className={styles.footer}>
        <button
          type="button"
          className={styles.textButton}
          onClick={() => {
            setError('')
            setMode('forgot')
          }}
        >
          Forgot your password?
        </button>
      </p>
      <p className={styles.footer}>
        New here? <Link href={paths.createAccount}>Create account</Link>
      </p>
    </AuthCard>
  )
}

export default SignInPage
