
import { useState, type SubmitEvent } from 'react'
import './App.css'

type Page = 'register' | 'verify' | 'success'

function App() {
  const [page, setPage] = useState<Page>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')

  function handleRegister(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setPage('verify')
  }

  return (
    <div className="app">
      <header className="header">
        <h1>3D Medical Report Viewer</h1>
      </header>

      <main className="main-content">
        {page === 'register' && (
          <section className="auth-card">
            <h2>Create Account</h2>
            <p className="subtitle">
              Start tracking your medical reports.
            </p>

            <form onSubmit={handleRegister}>
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Create password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <label htmlFor="confirmPassword">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
                required
              />

              {error && <p className="error" role="alert">{error}</p>}

              <button type="submit" className="primary-button">
                Create Account
              </button>
            </form>

            <p className="auth-footer">
              Already have an account?{' '}
              <span className="link-placeholder">Sign In</span>
            </p>
          </section>
        )}

        {page === 'verify' && (
          <section className="auth-card center">
            <div className="status-icon">✉</div>
            <h2>Check Your Email</h2>
            <p>
              In a real registration, a verification link
              would be sent to:
            </p>
            <p className="email-display">{email}</p>
            <p className="subtitle">
              Demo only — no email has been sent.
            </p>

            <button
              className="primary-button"
              onClick={() => setPage('success')}
            >
              Simulate Email Verification
            </button>

            <button
              className="text-button"
              onClick={() => setPage('register')}
            >
              Back to Registration
            </button>
          </section>
        )}

        {page === 'success' && (
          <section className="auth-card center">
            <div className="status-icon success-icon">✓</div>
            <h2>Verification Complete</h2>
            <p>
              Demo only — this is what a successful
              email verification screen would look like.
            </p>
            <button
              className="primary-button"
              onClick={() => {
                setPage('register')
                setEmail('')
                setPassword('')
                setConfirmPassword('')
                setError('')
              }}
            >
              Back to Registration
            </button>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
