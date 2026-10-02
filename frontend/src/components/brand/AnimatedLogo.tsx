import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import { Mark, COLORS } from './Logo'
import type { LogoProps } from './Logo'

export interface AnimatedLogoProps extends Omit<LogoProps, 'className'> {
  speed?: 'normal' | 'fast'
  className?: string
}

export function AnimatedLogo({
  size = 40,
  variant = 'icon',
  theme = 'dark',
  speed = 'normal',
  className,
}: AnimatedLogoProps) {
  const c = COLORS[theme]
  const shieldRef = useRef<SVGPathElement>(null)
  const checkRef = useRef<SVGPathElement>(null)

  useLayoutEffect(() => {
    const s = shieldRef.current
    if (s) {
      const len = s.getTotalLength()
      s.style.setProperty('--ng-draw-offset', String(len))
    }
    const k = checkRef.current
    if (k) {
      const len = k.getTotalLength()
      k.style.setProperty('--ng-check-offset', String(len))
    }
  }, [])

  const ws = Math.max(size / 5.6, 8)

  return (
    <div
      className={cn('flex flex-col items-center ng-logo-mark', className)}
      data-speed={speed}
      data-theme={theme}
    >
      <div style={{ width: size, height: size }}>
        <Mark
          size={size}
          theme={theme}
          animated
          shieldRef={shieldRef}
          checkRef={checkRef}
        />
      </div>

      {variant === 'full' ? (
        <div
          className="flex flex-col items-center"
          style={{ width: size, fontSize: `${ws * 0.5}px`, lineHeight: 1.1 }}
        >
          <span
            className="ng-logo-word font-bold uppercase"
            data-line="1"
            style={{ letterSpacing: '0.15em', fontSize: `${ws * 0.9}px`, color: c.ngs }}
          >
            NGS
          </span>
          <span
            className="ng-logo-word font-semibold uppercase"
            data-line="2"
            style={{ letterSpacing: '0.19em', fontSize: `${ws * 0.68}px`, color: c.system }}
          >
            NATIVITY GUARD SYSTEM
          </span>
          <span
            className="ng-logo-word uppercase"
            data-line="3"
            style={{ letterSpacing: '0.2em', fontSize: `${ws * 0.54}px`, color: c.hand }}
          >
            SECURITY IN YOUR HAND
          </span>
        </div>
      ) : null}
    </div>
  )
}
