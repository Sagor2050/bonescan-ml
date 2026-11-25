import styles from '../routing/PlaceholderScreen.module.css'

// The one page for every link that doesn't work: expired, revoked, all its
// reports deleted, or never made. It says nothing else, so it can't hint at why
// or at whose link it was (S10.3).
export const LINK_UNAVAILABLE = 'This link is no longer available.'

function LinkUnavailableScreen() {
  return (
    <main className={styles.screen}>
      <h1>{LINK_UNAVAILABLE}</h1>
    </main>
  )
}

export default LinkUnavailableScreen
