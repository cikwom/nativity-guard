import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { priorityMeta, statusMeta, type PriorityMeta, type StatusMeta } from '@/lib/status'

export function Badge({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode
  className?: string
  tone?: 'neutral' | 'signal' | 'ok' | 'warn' | 'emergency'
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-surface-hi text-ink-muted ring-border-hi',
    signal: 'bg-signal/10 text-signal ring-signal/30',
    ok: 'bg-ok/10 text-ok ring-ok/30',
    warn: 'bg-warn/10 text-warn ring-warn/30',
    emergency: 'bg-emergency/10 text-emergency ring-emergency/30',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Case lifecycle chip — dot + label, coloured by real backend status. */
export function StatusChip({
  status,
  showDescription = false,
  className,
}: {
  status: string | undefined
  showDescription?: boolean
  className?: string
}) {
  const meta: StatusMeta = statusMeta(status)
  return (
    <span
      title={meta.description}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1',
        meta.bg,
        meta.text,
        meta.ring,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
      {meta.label}
      {showDescription ? (
        <span className="sr-only"> — {meta.description}</span>
      ) : null}
    </span>
  )
}

export function PriorityChip({
  level,
  className,
}: {
  level: string | undefined
  className?: string
}) {
  const meta: PriorityMeta = priorityMeta(level)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1',
        meta.bg,
        meta.text,
        meta.ring,
        className,
      )}
    >
      {meta.label}
    </span>
  )
}
