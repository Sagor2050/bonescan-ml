import Link from './Link.tsx'
import { paths } from './paths.ts'
import styles from './PlaceholderScreen.module.css'

function NotFoundScreen() {
  return (
    <main className={styles.screen}>
      <h1>We can't find that page</h1>
      <p>
        <Link href={paths.home}>Go to the homepage</Link>
      </p>
    </main>
  )
}

export default NotFoundScreen
