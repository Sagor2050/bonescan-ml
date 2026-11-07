import BrandMark from './BrandMark.tsx'
import styles from './Footer.module.css'

const REPOSITORY = 'https://github.com/Sagor2050/bonescan-ml'
const TEAM_NAME = 'The White Coats'
const DEVELOPERS = ['Aliz', 'Jennifer', 'Justin', 'Sagor']
const LINKS = [
  { label: 'Source code', href: REPOSITORY },
  {
    label: 'Requirements',
    href: `${REPOSITORY}/blob/main/docs/requirements.pdf`,
  },
  {
    label: 'Project plan',
    href: `${REPOSITORY}/blob/main/docs/project-plan.pdf`,
  },
]

// On every screen, so the path back to the care team is never out of reach.
function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.about}>
        <span className={styles.brand}>
          <BrandMark />
        </span>
        <p>
          BoneScan3D shows what your report says and where it points. It is not
          a medical device and does not give medical advice. Ask your care team
          about your results and your care.
        </p>
        <p>A student project for CISC 3171, Fall 2026.</p>
      </div>

      <section className={styles.column} aria-labelledby="footer-team">
        <h2 id="footer-team">Team</h2>
        <p className={styles.team}>{TEAM_NAME}</p>
        <ul className={styles.names}>
          {DEVELOPERS.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </section>

      <nav className={styles.column} aria-labelledby="footer-links">
        <h2 id="footer-links">Project</h2>
        <ul>
          {LINKS.map(({ label, href }) => (
            <li key={label}>
              <a href={href}>{label}</a>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  )
}

export default Footer
