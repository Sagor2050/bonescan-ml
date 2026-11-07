import { useEffect } from 'react'
import { useSession } from '../account/session.ts'
import Link from '../routing/Link.tsx'
import { paths } from '../routing/paths.ts'
import { navigate } from '../routing/router.ts'
import BrandMark from '../ui/BrandMark.tsx'
import styles from './HomePage.module.css'
import skeletonPreview from './skeleton-preview.jpg'

const features = [
  {
    title: 'Add your report',
    text: 'Upload the PDF or paste the text of your imaging report.',
  },
  {
    title: 'See it in 3D',
    text: 'Each fracture you confirm is marked on a 3D skeleton.',
  },
  {
    title: 'Compare over time',
    text: 'Line up your reports by exam date and compare any two.',
  },
]

function HomePage() {
  const session = useSession()

  // A confirmation link can land here and sign the patient in (Plan A.2).
  useEffect(() => {
    if (session.status === 'signed-in') {
      navigate(paths.reports, { replace: true })
    }
  }, [session.status])

  return (
    <>
      <header className={styles.header}>
        <span className={styles.brand}>
          <BrandMark />
        </span>
        <nav className={styles.nav}>
          <a href="#about">About</a>
          <Link href={paths.signIn}>Sign in</Link>
        </nav>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <h1>Understand your imaging report in 3D</h1>
            <p>
              Add your report, check the fractures it lists, and see where each
              one is on a 3D skeleton.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primary} href={paths.createAccount}>
                Create account
              </Link>
              <Link className={styles.secondary} href={paths.signIn}>
                Sign in
              </Link>
            </div>
          </div>
          <figure className={styles.preview}>
            <img
              src={skeletonPreview}
              alt="A 3D skeleton with a labeled marker on the left forearm."
              width="720"
              height="620"
            />
            <figcaption>
              An example from a made-up report, on a standard adult skeleton.
            </figcaption>
          </figure>
        </section>

        <ol className={styles.features}>
          {features.map((feature) => (
            <li key={feature.title}>
              <h2>{feature.title}</h2>
              <p>{feature.text}</p>
            </li>
          ))}
        </ol>

        <section id="about" className={styles.about}>
          <h2>What BoneScan does and does not do</h2>
          <p>BoneScan shows you what your report says and where it points.</p>
          <ul>
            <li>
              The skeleton is a standard adult model. It is not a model of your
              own bones.
            </li>
            <li>
              BoneScan does not diagnose you, predict how you will heal, or give
              medical advice.
            </li>
          </ul>
          <p>
            Your care team makes those calls. Ask them about your results and
            your care.
          </p>
        </section>
      </main>

      <footer className={styles.footer}>
        BoneScan is a student project. It is not a medical device and does not
        give medical advice.
      </footer>
    </>
  )
}

export default HomePage
