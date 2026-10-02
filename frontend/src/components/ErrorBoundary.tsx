import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

/**
 * The last line of defence against a blank screen.
 *
 * Before this, a render throw left nothing but an empty `<div id="root">` — the
 * role self-redirect that React kills as "Maximum update depth exceeded" presented
 * as a black page with no explanation and no way out. Anything that throws now
 * becomes a screen a person can read, report and leave.
 *
 * Deliberately router-free. It is mounted in `main.tsx` *outside* `BrowserRouter`,
 * so it cannot use `<Link>` or `useNavigate` — and recovery uses a real page
 * navigation for the same reason: after a crash the router's own state may be
 * exactly what threw, so a full load is the honest reset.
 *
 * Must be a class: `getDerivedStateFromError` and `componentDidCatch` have no
 * hook equivalent.
 */
interface Props {
  children: ReactNode
  /** Heading shown in the fallback — name the scope that failed. */
  title?: string
  /** Fill the viewport. True at the root, false inside the app shell. */
  fullPage?: boolean
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No reporting service is wired up, so the console is the only place this
    // goes. Log it explicitly rather than letting the boundary swallow it.
    console.error('Unhandled render error:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const { title = 'Something went wrong on this screen', fullPage = false } = this.props
    // A thrown `Error` with no message is common (a bare `throw new Error()`), so
    // the name is a better second choice than an empty box.
    const detail = error.message || error.name || 'Unknown error'

    return (
      <div
        role="alert"
        className={cn(
          'flex flex-col items-center justify-center gap-4 px-6 py-16 text-center',
          fullPage ? 'min-h-screen bg-base' : 'min-h-[60vh]',
        )}
      >
        <span className="grid size-12 place-items-center rounded-full bg-warn/10 text-warn">
          <AlertTriangle className="size-5" aria-hidden />
        </span>

        <div>
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink-muted">
            We stopped rather than show you something incomplete. Reloading usually clears it — if it
            keeps happening, send this message to the team.
          </p>
        </div>

        <pre className="max-w-md overflow-x-auto rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-left text-[11px] whitespace-pre-wrap text-warn tabular">
          {detail}
        </pre>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<RotateCw className="size-4" aria-hidden />}
            onClick={() => window.location.reload()}
          >
            Reload
          </Button>
          {/* A real anchor, not `<Link>` — see the note above on why this component
              stays outside the router. */}
          <a
            href="/"
            className="inline-flex h-9 items-center rounded-lg border border-border-hi bg-surface-hi px-3 text-sm text-ink transition-colors hover:bg-surface-hi/80"
          >
            Back to home
          </a>
        </div>
      </div>
    )
  }
}
