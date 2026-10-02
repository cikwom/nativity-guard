import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * The one "back to the list" affordance.
 *
 * Shared rather than copied per page: three pages each grew their own copy of the
 * same eight lines, which is how the same control ends up three different sizes.
 * The label names the destination (`Back to queue`, `Back to my reports`), never
 * just "Back" — a bare arrow tells the reader nothing about where it goes.
 */
export function BackLink({
  to,
  label,
  className,
}: {
  to: string
  label: string
  className?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-ink',
        className,
      )}
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      {label}
    </Link>
  )
}
