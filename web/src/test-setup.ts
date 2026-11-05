import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)

// jsdom has no scrolling, and navigating scrolls to the top of the page.
window.scrollTo = () => {}
