import styles from './HomePage.module.css'

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
  return (
    <>
      <header className={styles.header}>
        <span className={styles.brand}>BoneScan</span>
        <nav className={styles.nav}>
          <a href="#about">About</a>
          <a href="/sign-in">Sign in</a>
        </nav>
      </header>

      <main>
        <section className={styles.hero}>
          <h1>Understand your imaging report in 3D</h1>
          <p>
            Add your report, check the fractures it lists, and see where each
            one is on a 3D skeleton.
          </p>
          <div className={styles.actions}>
            <a className={styles.primary} href="/create-account">
              Create account
            </a>
            <a className={styles.secondary} href="/sign-in">
              Sign in
            </a>
          </div>
        </section>

        <ul className={styles.features}>
          {features.map((feature) => (
            <li key={feature.title}>
              <h2>{feature.title}</h2>
              <p>{feature.text}</p>
            </li>
          ))}
        </ul>

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
