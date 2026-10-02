import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  block?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-signal text-signal-ink hover:bg-signal/90 border border-transparent font-semibold',
  secondary:
    'bg-surface-hi text-ink hover:bg-surface-hi/80 border border-border-hi',
  ghost: 'bg-transparent text-ink-muted hover:text-ink hover:bg-surface-hi/60 border border-transparent',
  danger: 'bg-emergency text-white hover:bg-emergency/90 border border-transparent font-semibold',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  block = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed select-none whitespace-nowrap',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}
