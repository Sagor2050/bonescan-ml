import type { ReactNode } from 'react'
import Link from '../routing/Link.tsx'
import BrandMark from './BrandMark.tsx'
import styles from './TopBar.module.css'

// The bar across the top of every screen: the logo, and whatever links that
// screen needs.
function TopBar({
  brandHref,
  children,
}: {
  brandHref: string
  children?: ReactNode
}) {
  return (
    <header className={styles.bar}>
      <Link className={styles.brand} href={brandHref}>
        <BrandMark />
      </Link>
      {children && (
        <nav className={styles.nav} aria-label="Main">
          {children}
        </nav>
      )}
    </header>
  )
}

export default TopBar
