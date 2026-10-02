import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { homePathForRole } from '@/auth/RequireRole'

export function NotFoundPage() {
  const { role } = useAuth()
  // This page renders behind the guard, so the role has a home; the fallback keeps
  // the link honest rather than letting `null` reach an href.
  const home = homePathForRole(role) ?? '/'

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-surface-hi text-ink-faint">
        <Compass className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">Page not found</p>
        <p className="mt-1 max-w-sm text-xs text-ink-muted">
          That address doesn't match anything in the console. It may have moved, or you may not have
          access to it.
        </p>
      </div>
      <Link
        to={home}
        className="inline-flex h-9 items-center rounded-lg border border-border-hi bg-surface-hi px-3 text-sm text-ink transition-colors hover:bg-surface-hi/80"
      >
        Back to home
      </Link>
    </div>
  )
}
