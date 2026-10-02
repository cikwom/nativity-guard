import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

/** Show the banner for at least this long so a fast navigation isn't a flash. */
const MIN_VISIBLE_MS = 600
/** ...and at most this long, so it can never stick if a page never settles. */
const MAX_VISIBLE_MS = 6000

/** Map a pathname to the banner message that fits the page loading. */
function routeMessage(pathname: string): string {
  if (pathname === '/map') return 'Locating you…'
  if (pathname === '/sos') return 'Preparing SOS…'
  if (pathname === '/cases' || pathname.startsWith('/cases/')) return 'Loading cases…'
  if (pathname === '/units' || pathname.startsWith('/officer/')) return 'Loading units…'
  return 'Loading…'
}

/**
 * Drive the route-loading banner from react-router's location.
 *
 * We can't know when every page has finished fetching its data, so the banner
 * is shown for a bounded window: a minimum so it is legible, and a hard maximum
 * so it is guaranteed to clear. The boot message surfaces once, then the
 * per-route message takes over.
 */
export function useRouteLoading(): { loading: boolean; message: string } {
  const { pathname } = useLocation()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('Starting Nativity Guard…')
  const booted = useRef(false)
  const minTimer = useRef<number | undefined>(undefined)
  const maxTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const msg = booted.current ? routeMessage(pathname) : 'Starting Nativity Guard…'
    booted.current = true
    setMessage(msg)
    setLoading(true)

    // Floor: don't clear before the minimum, so the banner is seen.
    minTimer.current = window.setTimeout(() => {
      minTimer.current = undefined
    }, MIN_VISIBLE_MS)
    // Ceiling: clear regardless, so it never sticks.
    maxTimer.current = window.setTimeout(() => setLoading(false), MAX_VISIBLE_MS)

    return () => {
      if (minTimer.current !== undefined) clearTimeout(minTimer.current)
      if (maxTimer.current !== undefined) clearTimeout(maxTimer.current)
    }
  }, [pathname])

  return { loading, message }
}
