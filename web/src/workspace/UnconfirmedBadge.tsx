import type { SavedReport } from './reportStore.ts'
import styles from './UnconfirmedBadge.module.css'

// A shared report the patient hasn't confirmed yet says so in words, not color
// alone (S10.3, NFR12).
function UnconfirmedBadge({ report }: { report: SavedReport }) {
  if (!report.shared || report.shared.confirmed) return null
  return <span className={styles.badge}>Unconfirmed</span>
}

export default UnconfirmedBadge
