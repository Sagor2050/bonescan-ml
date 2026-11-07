import type { ReactNode } from 'react'
import { signOut } from '../account/auth.ts'
import RequireSignIn from '../account/RequireSignIn.tsx'
import { useSession } from '../account/session.ts'
import Link from '../routing/Link.tsx'
import { paths } from '../routing/paths.ts'
import { usePath } from '../routing/router.ts'
import TopBar from '../ui/TopBar.tsx'
import styles from './WorkspaceLayout.module.css'

// The header on the screens a signed-in patient uses (Plan A.4 to A.6). Adding a
// report is the app's one main action, so it's always in the same place, except
// while the patient is already doing it.
function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = useSession()
  const path = usePath()
  const inReports = path === paths.reports || path.startsWith(`${paths.reports}/`)
  const addingReport = path === paths.addReport || path === paths.verifyFindings

  return (
    <>
      <TopBar brandHref={paths.reports}>
        <Link
          className="nav-button"
          href={paths.reports}
          aria-current={inReports ? 'page' : undefined}
        >
          My reports
        </Link>
        <Link
          className="nav-button"
          href={paths.account}
          aria-current={path === paths.account ? 'page' : undefined}
        >
          Account
        </Link>
        {session.status === 'signed-in' && (
          <button
            type="button"
            className="nav-button"
            onClick={() => signOut()}
          >
            Sign out
          </button>
        )}
        {!addingReport && (
          <Link className={`btn btn-primary ${styles.add}`} href={paths.addReport}>
            Add a report
          </Link>
        )}
      </TopBar>
      <RequireSignIn>{children}</RequireSignIn>
    </>
  )
}

export default WorkspaceLayout
