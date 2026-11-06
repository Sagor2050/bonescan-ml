import type { ReactNode } from 'react'
import { signOut } from '../account/auth.ts'
import RequireSignIn from '../account/RequireSignIn.tsx'
import { useSession } from '../account/session.ts'
import Link from '../routing/Link.tsx'
import { paths } from '../routing/paths.ts'
import styles from './WorkspaceLayout.module.css'

// The header on the screens a signed-in patient uses (Plan A.4 to A.6).
function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = useSession()
  return (
    <>
      <header className={styles.header}>
        <Link className={styles.brand} href={paths.reports}>
          BoneScan
        </Link>
        <nav className={styles.nav}>
          <Link href={paths.reports}>My reports</Link>
          <Link href={paths.account}>Account</Link>
          {session.status === 'signed-in' && (
            <button
              type="button"
              className={styles.signOut}
              onClick={() => signOut()}
            >
              Sign out
            </button>
          )}
        </nav>
      </header>
      <RequireSignIn>{children}</RequireSignIn>
    </>
  )
}

export default WorkspaceLayout
