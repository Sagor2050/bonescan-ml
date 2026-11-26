import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

// jsdom has no scrolling, and navigating scrolls to the top of the page. The
// server's tests run in Node, which has no window at all.
if (typeof window !== 'undefined') {
  window.scrollTo = () => {}
  Element.prototype.scrollIntoView = () => {}
}
