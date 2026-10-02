import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TabItem {
  id: string
  label: string
  count?: number
  icon?: ReactNode
}

/**
 * Accessible tabs (ARIA tablist/tab/tabpanel) with arrow-key navigation.
 * Controlled: the parent owns `activeId`.
 */
export function Tabs({
  items,
  activeId,
  onChange,
  className,
}: {
  items: TabItem[]
  activeId: string
  onChange: (id: string) => void
  className?: string
}) {
  const listRef = useRef<HTMLDivElement>(null)

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = items.findIndex((i) => i.id === activeId)
    if (index < 0) return
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % items.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else return

    event.preventDefault()
    onChange(items[next].id)
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons?.[next]?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className={cn(
        'flex gap-1 overflow-x-auto border-b border-border px-1 [-webkit-overflow-scrolling:touch]',
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.id === activeId
        return (
          <button
            key={item.id}
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`panel-${item.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors',
              selected ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {item.icon}
            {item.label}
            {typeof item.count === 'number' ? (
              <span className="rounded-full bg-surface-hi px-1.5 py-0.5 text-[10px] tabular-nums text-ink-muted">
                {item.count}
              </span>
            ) : null}
            {selected ? (
              <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-signal" aria-hidden />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({
  id,
  children,
  className,
}: {
  id: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
      className={cn('focus:outline-none', className)}
    >
      {children}
    </div>
  )
}
