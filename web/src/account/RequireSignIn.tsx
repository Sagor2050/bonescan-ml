import { useEffect, type ReactNode } from 'react'
import { paths } from '../routing/paths.ts'
import { navigate } from '../routing/router.ts'
import { useSession } from './session.ts'

// Keeps a patient's screens behind sign-in. Row-level security is what protects
// the data. This only sends a signed-out visitor to the right screen.
function RequireSignIn({ children }: { children: ReactNode }) {
  const session = useSession()

  useEffect(() => {
    if (session.status === 'signed-out') {
      navigate(paths.signIn, { replace: true })
    }
  }, [session.status])

  if (session.status === 'loading') {
    return (
      <p className="page-message" role="status">
        Loading…
      </p>
    )
  }
  if (session.status === 'signed-out') return null
  return children
}

export default RequireSignIn
