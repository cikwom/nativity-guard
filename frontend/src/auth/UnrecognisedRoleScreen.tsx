import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/**
 * Shown when a session is valid but its role is not one this build can name.
 *
 * Deliberately not a redirect and not a console. Guessing a destination is how a
 * mismatched role string (a legacy `super-admin` row) used to send the app to `/`,
 * have `HomeRoute` send it back, and blank the screen — so this screen states the
 * problem instead. The raw value is shown because it is the one fact that lets an
 * administrator fix the account.
 *
 * The framing matters as much as the function: this is a gap in our deployment, not
 * something the user did. Nothing here should read as an accusation or a failure.
 */
export function UnrecognisedRoleScreen({
  rawRole,
  onSignOut,
}: {
  rawRole: string | null
  onSignOut: () => void
}) {
  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-base px-6 text-center"
    >
      <span className="grid size-12 place-items-center rounded-full bg-warn/10 text-warn">
        <ShieldAlert className="size-5" aria-hidden />
      </span>

      <div>
        <p className="text-sm font-semibold text-ink">Your account role isn't recognised</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-ink-muted">
          You are signed in, but this version of the console doesn't know the role{' '}
          <code className="tabular rounded bg-surface-hi px-1 py-0.5 text-ink">
            {rawRole ?? 'unknown'}
          </code>{' '}
          on your account, so it can't open the right dashboard. This is a problem with our
          setup, not with your account.
        </p>
        <p className="mx-auto mt-2 max-w-md text-xs text-ink-muted">
          A platform administrator can correct the role. Signing out and back in will not change it.
        </p>
      </div>

      <Button size="sm" variant="secondary" onClick={onSignOut}>
        Sign out
      </Button>
    </div>
  )
}
