import type { Ref } from 'react'
import { cn } from '@/lib/cn'

export interface LogoProps {
  size?: number
  variant?: 'full' | 'icon'
  theme?: 'dark' | 'light'
  className?: string
}

export const COLORS: Record<NonNullable<LogoProps['theme']>, Record<string, string>> = {
  dark: {
    shield: '#c2d4c7',
    rings: '#f4cb78',
    dots: '#f4cb78',
    check: '#f4cb78',
    ngs: '#f8f5e9',
    system: '#c2d4c7',
    hand: '#9db9a8',
  },
  light: {
    shield: '#0f172a',
    rings: '#b45309',
    dots: '#b45309',
    check: '#b45309',
    ngs: '#0f172a',
    system: '#8a6d3b',
    hand: '#7c5318',
  },
}

export const SHIELD_PATH = 'M 14 12 L 50 12 L 58 32 L 42 62 L 32 70 L 22 62 L 6 32 Z'
export const CHECK_PATH = 'M -6 2 L 0 10 L 8 -6'
export const SWEEP_PATH = 'M 0 0 L 21 -6 A 22 22 0 0 1 21 6 Z'

type RingSpec = { r: number; count: number; idx: number }
export const RINGS: RingSpec[] = [
  { r: 10, count: 4, idx: 1 },
  { r: 16, count: 4, idx: 2 },
  { r: 22, count: 6, idx: 3 },
]

export function dotPositions(r: number, count: number) {
  const step = (2 * Math.PI) / count
  const start = -Math.PI / 2
  return Array.from({ length: count }, (_, i) => {
    const a = start + i * step
    return { x: r * Math.cos(a), y: r * Math.sin(a) }
  })
}

export interface MarkProps {
  size: number
  theme?: 'dark' | 'light'
  animated?: boolean
  className?: string
  shieldRef?: Ref<SVGPathElement>
  checkRef?: Ref<SVGPathElement>
}

export function Mark({
  size,
  theme = 'dark',
  animated = false,
  className,
  shieldRef,
  checkRef,
}: MarkProps) {
  const c = COLORS[theme]

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="NGS mark"
      className={cn('overflow-visible', animated && 'ng-logo-mark', className)}
    >
      <defs>
        <linearGradient id="ng-sweep-gradient" x1="32" y1="38" x2="54" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={c.rings} />
          <stop offset="100%" stopColor={c.rings} stopOpacity="0" />
        </linearGradient>
      </defs>

      <g transform="translate(32 38)">
        {RINGS.map((ring) => (
          <circle
            key={ring.r}
            cx={0}
            cy={0}
            r={ring.r}
            stroke={c.rings}
            strokeWidth={1.5}
            fill="none"
            className={cn(animated && 'ng-logo-ring-pulse', animated && `ng-logo-ring-${ring.idx}`)}
            data-ring={ring.idx}
          />
        ))}

        {RINGS.map((ring) =>
          dotPositions(ring.r, ring.count).map((p, i) => (
            <circle
              key={`${ring.r}-${i}`}
              cx={p.x}
              cy={p.y}
              r={2}
              fill={c.dots}
              className={cn(animated && 'ng-logo-dot')}
              style={animated ? { animationDelay: `${(i * 137 + ring.idx * 50) % 900}ms` } : undefined}
            />
          )),
        )}

        {animated ? (
          <path
            d={SWEEP_PATH}
            fill="url(#ng-sweep-gradient)"
            className="ng-logo-sweep"
            style={{ transformOrigin: '0 0' }}
          />
        ) : null}

        <path
          ref={checkRef}
          d={CHECK_PATH}
          stroke={c.check}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className={cn(animated && 'ng-logo-check-draw')}
        />
      </g>

      <path
        ref={shieldRef}
        d={SHIELD_PATH}
        stroke={c.shield}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className={cn(animated && 'ng-logo-shield-draw')}
      />
    </svg>
  )
}

export function Logo({ size = 40, variant = 'icon', theme = 'dark', className }: LogoProps) {
  const c = COLORS[theme]
  const ws = Math.max(size / 5.6, 8)

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div style={{ width: size, height: size }}>
        <Mark size={size} theme={theme} />
      </div>

      {variant === 'full' ? (
        <div
          className="flex flex-col items-center"
          style={{ width: size, fontSize: `${ws * 0.5}px`, lineHeight: 1.1 }}
        >
          <span
            className="font-bold uppercase"
            style={{ letterSpacing: '0.15em', fontSize: `${ws * 0.9}px`, color: c.ngs }}
          >
            NGS
          </span>
          <span
            className="font-semibold uppercase"
            style={{ letterSpacing: '0.19em', fontSize: `${ws * 0.68}px`, color: c.system }}
          >
            NATIVITY GUARD SYSTEM
          </span>
          <span
            className="uppercase"
            style={{ letterSpacing: '0.2em', fontSize: `${ws * 0.54}px`, color: c.hand }}
          >
            SECURITY IN YOUR HAND
          </span>
        </div>
      ) : null}
    </div>
  )
}
