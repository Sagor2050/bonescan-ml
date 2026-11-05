import Link from './Link.tsx'
import styles from './PlaceholderScreen.module.css'

type PlaceholderScreenProps = {
  title: string
  links?: { href: string; label: string }[]
}

// Holds a screen's place until the screen itself is built.
function PlaceholderScreen({ title, links = [] }: PlaceholderScreenProps) {
  return (
    <main className={styles.screen}>
      <h1>{title}</h1>
      <p>This screen is not built yet.</p>
      {links.length > 0 && (
        <ul>
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default PlaceholderScreen
