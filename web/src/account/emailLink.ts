import { paths } from '../routing/paths.ts'

// When an email link can't be used, because it expired or a newer email replaced
// it, Supabase sends the browser back with the reason after the #. It can land on
// any page, and that page would look normal, so the patient would never know.
export function isFailedEmailLink(hash: string) {
  const reason = new URLSearchParams(hash.replace(/^#/, ''))
  return reason.has('error') || reason.has('error_code')
}

/** Run before the first render, so a failed link opens the sign-in screen. */
export function showFailedEmailLink() {
  if (isFailedEmailLink(window.location.hash)) {
    window.history.replaceState(null, '', `${paths.signIn}?link=failed`)
  }
}

export function cameFromFailedEmailLink() {
  return new URLSearchParams(window.location.search).get('link') === 'failed'
}
