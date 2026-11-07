import { useEffect, useState, type SubmitEvent } from 'react'
import {
  EmailNotConfirmedError,
  requestPasswordReset,
  resendConfirmation,
  signIn,
} from '../account/auth.ts'
import AuthCard from '../account/AuthCard.tsx'
import styles from '../account/AuthCard.module.css'
import { cameFromFailedEmailLink } from '../account/emailLink.ts'
import { useSession } from '../account/session.ts'
import Link from '../routing/Link.tsx'
import { paths } from '../routing/paths.ts'
import { navigate } from '../routing/router.ts'

// Plan A.2. A returning patient lands on their timeline.
function SignInPage() {
  const session = useSession()
  const [mode, setMode] = useState<
    'sign-in' | 'forgot' | 'sent' | 'resend' | 'resent'
  >('sign-in')
  const [linkFailed, setLinkFailed] = useState(cameFromFailedEmailLink)
  const [unconfirmed, setUnconfirmed] = useState(false)
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
    setUnconfirmed(false)
    setBusy(true)
    try {
      await action()
    } catch (problem) {
      setError((problem as Error).message)
      setUnconfirmed(problem instanceof EmailNotConfirmedError)
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

  function sendNewConfirmation() {
    return attempt(async () => {
      await resendConfirmation(email)
      setLinkFailed(false)
      setMode('resent')
    })
  }

  function handleResend(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    return sendNewConfirmation()
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

  if (mode === 'resent') {
    return (
      <AuthCard title="Check your email">
        <p>
          If <span className={styles.email}>{email}</span> still needs
          confirming, we sent it a new link. Use the link in that newest email,
          because older links no longer work.
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

  if (mode === 'forgot' || mode === 'resend') {
    const forgot = mode === 'forgot'
    return (
      <AuthCard
        title={forgot ? 'Choose a new password' : 'Confirm your email'}
        subtitle={
          forgot
            ? "We'll send a link to your confirmed email address."
            : "We'll send a new link to confirm your email address."
        }
      >
        <form onSubmit={forgot ? handleForgot : handleResend}>
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
      {linkFailed && (
        <div className={styles.notice} role="status">
          <p>
            That email link didn't work. It may have expired, or a newer email
            may have replaced it. If you've already confirmed your email, you
            can sign in.
          </p>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => {
              setError('')
              setMode('resend')
            }}
          >
            Send a new confirmation link
          </button>
        </div>
      )}
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
        {unconfirmed && (
          <p className={styles.resend}>
            <button
              type="button"
              className={styles.textButton}
              disabled={busy}
              onClick={sendNewConfirmation}
            >
              Send a new confirmation link
            </button>
          </p>
        )}
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
