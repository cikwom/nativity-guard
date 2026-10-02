import { useEffect, useState } from 'react'
import { AnimatedLogo } from '@/components/brand/AnimatedLogo'
import { cn } from '@/lib/cn'

export interface LoadingBannerProps {
  show: boolean
  message?: string
}

const RETRY_AFTER_MS = 15_000
const FADE_OUT_MS = 400

/**
 * Full-viewport loading overlay shown on route changes.
 *
 * It can never block forever: after 15s of a continuous `show` it offers a
 * Retry that hard-reloads, and it always fades out on `show=false`. The mark
 * is the NGS animated logo.
 */
export function LoadingBanner({ show, message = 'Loading…' }: LoadingBannerProps) {
  const [mounted, setMounted] = useState(show)
  const [visible, setVisible] = useState(show)
  const [troubled, setTroubled] = useState(false)

  useEffect(() => {
    if (show) {
      setMounted(true)
      requestAnimationFrame(() => setVisible(true))
      setTroubled(false)
      const t = setTimeout(() => setTroubled(true), RETRY_AFTER_MS)
      return () => clearTimeout(t)
    }

    setVisible(false)
    const t = setTimeout(() => setMounted(false), FADE_OUT_MS)
    return () => clearTimeout(t)
  }, [show])

  if (!mounted) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[#0b0d10]',
        visible
          ? 'opacity-100 transition-opacity duration-250 ease-out'
          : 'opacity-0 transition-opacity duration-400 ease-in',
      )}
    >
      <AnimatedLogo size={72} variant="full" theme="dark" />
      <p className="text-sm text-ink-muted">
        {troubled ? 'Trouble connecting — poor network?' : message}
      </p>
      {troubled ? (
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') window.location.reload()
          }}
          className="rounded-lg border border-border-hi bg-surface px-4 py-2 text-sm text-ink transition-colors hover:bg-surface-hi"
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}
