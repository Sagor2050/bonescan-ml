import { useSyncExternalStore } from 'react'

// The app's own small router (#34): the URL path picks the screen. It is small
// enough that a routing library isn't worth adding a dependency for. The path
// also has to work when opened directly, which is what web/vercel.json is for.

export type RouteParams = Record<string, string>

const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  window.addEventListener('popstate', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('popstate', onChange)
  }
}

function getPath() {
  return window.location.pathname
}

export function usePath() {
  return useSyncExternalStore(subscribe, getPath)
}

// Going back or forward fires popstate, and the browser restores the scroll
// position itself. Only a new navigation starts at the top of the page.
export function navigate(to: string, { replace = false } = {}) {
  if (replace) {
    window.history.replaceState(null, '', to)
  } else {
    window.history.pushState(null, '', to)
  }
  window.scrollTo(0, 0)
  listeners.forEach((listener) => listener())
}

function segments(path: string) {
  return path.split('/').filter(Boolean)
}

// Returns the values of a pattern's :params, or null if the path doesn't match.
export function matchPath(pattern: string, path: string): RouteParams | null {
  const patternParts = segments(pattern)
  const pathParts = segments(path)
  if (patternParts.length !== pathParts.length) return null

  const params: RouteParams = {}
  for (const [index, part] of patternParts.entries()) {
    const value = pathParts[index]
    if (part.startsWith(':')) {
      try {
        params[part.slice(1)] = decodeURIComponent(value)
      } catch {
        return null
      }
    } else if (part !== value) {
      return null
    }
  }
  return params
}
