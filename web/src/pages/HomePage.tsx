import { lazy, Suspense, useEffect } from 'react'
import { useSession } from '../account/session.ts'
import Link from '../routing/Link.tsx'
import { paths } from '../routing/paths.ts'
import { navigate } from '../routing/router.ts'
import { CheckIcon, CrossIcon, InfoIcon } from '../ui/icons.tsx'
import TopBar from '../ui/TopBar.tsx'
import ViewerErrorBoundary from '../viewer/ViewerErrorBoundary.tsx'
import styles from './HomePage.module.css'
import skeletonPreview from './skeleton-preview.jpg'

// Loaded after the page, so the words and buttons don't wait for the 3D code.
const TurningSkeleton = lazy(() => import('./TurningSkeleton.tsx'))

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

const does = [
  'Lists each fracture your report describes, for you to check.',
  'Marks each one you confirm on a 3D skeleton, beside your report.',
  'Keeps your reports private to your account. It asks only for an email address and a password.',
]

const doesNot = [
  'The skeleton is a standard adult model. It is not a model of your own bones.',
  'BoneScan does not diagnose you, predict how you will heal, or give medical advice.',
  'BoneScan reads only the words in your report. It does not read X-ray images.',
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
      <TopBar brandHref={paths.home}>
        <a className="nav-button" href="#about">
          About
        </a>
        <Link className="nav-button" href={paths.signIn}>
          Sign in
        </Link>
      </TopBar>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <h1>Understand your imaging report in 3D</h1>
            <p>
              Add your report, check the fractures it lists, and see where each
              one is on a 3D skeleton.
            </p>
            <div className={styles.actions}>
              <Link
                className="btn btn-primary btn-large"
                href={paths.createAccount}
              >
                Create account
              </Link>
              <Link className="btn btn-large" href={paths.signIn}>
                Sign in
              </Link>
            </div>
            <button className={styles.demo} disabled>
              Quick demo (coming soon)
            </button>
          </div>
          <figure className={styles.stage}>
            <figcaption className={styles.notice}>
              <InfoIcon />
              <span>
                This is a standard adult skeleton, not a model of your own
                bones.
              </span>
            </figcaption>
            <ViewerErrorBoundary
              fallback={
                <img
                  className={styles.still}
                  src={skeletonPreview}
                  alt="A 3D skeleton with a labeled marker on the left forearm."
                />
              }
            >
              <Suspense
                fallback={<p className={styles.loading}>Loading the skeleton…</p>}
              >
                <TurningSkeleton />
              </Suspense>
            </ViewerErrorBoundary>
          </figure>
        </section>

        <section className={styles.how} aria-labelledby="how-it-works">
          <div className={styles.band}>
            <h2 id="how-it-works">How it works</h2>
            <ol className={styles.features}>
              {features.map((feature) => (
                <li key={feature.title}>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="about" className={styles.about}>
          <h2>What BoneScan does and does not do</h2>
          <p>BoneScan shows you what your report says and where it points.</p>
          <div className={styles.columns}>
            <div>
              <h3>What it does</h3>
              <ul>
                {does.map((item) => (
                  <li key={item}>
                    <span className={styles.yes}>
                      <CheckIcon />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>What it does not do</h3>
              <ul>
                {doesNot.map((item) => (
                  <li key={item}>
                    <span className={styles.no}>
                      <CrossIcon />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className={styles.careTeam}>
            Your care team makes those calls. Ask them about your results and
            your care.
          </p>
        </section>
      </main>
    </>
  )
}

export default HomePage
