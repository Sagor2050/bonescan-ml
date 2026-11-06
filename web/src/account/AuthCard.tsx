import type { ReactNode } from 'react'
import Link from '../routing/Link.tsx'
import { paths } from '../routing/paths.ts'
import styles from './AuthCard.module.css'
import { useSession } from './session.ts'

// The frame around the account screens (Plan A.2).
function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  const session = useSession()
  return (
    <>
      <header className={styles.header}>
        <Link className={styles.brand} href={paths.home}>
          BoneScan
        </Link>
      </header>
      <main className={styles.main}>
        <section className={styles.card}>
          <h1>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {session.status === 'no-accounts' && (
            <p className={styles.error}>
              Accounts aren't set up on this copy of the app.{' '}
              <Link href={paths.reports}>Go to my reports</Link>
            </p>
          )}
          {children}
        </section>
      </main>
    </>
  )
}

export default AuthCard
