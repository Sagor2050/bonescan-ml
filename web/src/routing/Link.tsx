import type { ComponentProps, MouseEvent } from 'react'
import { navigate } from './router.ts'

type LinkProps = ComponentProps<'a'> & { href: string }

// A normal link that changes screens without reloading the page, so the
// Workspace Controller's state survives. Opening it in a new tab still works.
function Link({ href, onClick, ...rest }: LinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    const opensElsewhere =
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (rest.target !== undefined && rest.target !== '_self')
    if (event.defaultPrevented || opensElsewhere) return

    event.preventDefault()
    navigate(href)
  }

  return <a href={href} onClick={handleClick} {...rest} />
}

export default Link
