import type { ReactNode } from 'react'
import Link from '../routing/Link.tsx'
import { paths } from '../routing/paths.ts'
import styles from './WorkspaceLayout.module.css'

// The header on the screens a signed-in patient uses (Plan A.4 to A.6).
function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className={styles.header}>
        <Link className={styles.brand} href={paths.reports}>
          BoneScan
        </Link>
        <nav className={styles.nav}>
          <Link href={paths.reports}>My reports</Link>
          <Link href={paths.account}>Account</Link>
        </nav>
      </header>
      {children}
    </>
  )
}

export default WorkspaceLayout
