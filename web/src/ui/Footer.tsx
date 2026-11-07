import BrandMark from './BrandMark.tsx'
import styles from './Footer.module.css'

const SOURCE_CODE = 'https://github.com/Sagor2050/bonescan-ml'

// On every screen, so the path back to the care team is never out of reach.
function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.about}>
        <span className={styles.brand}>
          <BrandMark />
        </span>
        <p>
          BoneScan shows what your report says and where it points. It is not a
          medical device and does not give medical advice. Ask your care team
          about your results and your care.
        </p>
      </div>
      <p className={styles.credit}>
        A student project by The White Coats, CISC 3171, Fall 2026.{' '}
        <a href={SOURCE_CODE}>Source code</a>
      </p>
    </footer>
  )
}

export default Footer
