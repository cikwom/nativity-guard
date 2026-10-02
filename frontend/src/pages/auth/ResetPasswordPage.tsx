import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Shield } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { useAuth } from '@/auth/AuthContext'
import { api, ApiError } from '@/lib/apiClient'
import {
  MIN_RESET_PASSWORD_LENGTH,
  RESET_CODE_LENGTH,
  RESET_CODE_TTL_MINUTES,
  maskIdentifier,
  normaliseResetCode,
  validateNewPassword,
  validateResetCode,
} from '@/lib/passwordReset'
import { MOCK_RESET_CODE, USE_MOCKS } from '@/mocks/config'
import type { ResetPasswordResponse } from '@/types/api'

/**
 * What step one hands over. Optional because this screen stands on its own: the
 * code is the only thing `POST /auth/reset-password` needs, so a reload — which
 * drops router state — must not leave the page unable to finish.
 */
interface ResetHandoff {
  identifier?: string
  sent?: boolean
}

/**
 * Step two of recovery: the code, and the new password.
 *
 * Two behaviours of `POST /auth/reset-password` shape this screen:
 *
 *  1. It refuses anything under 8 characters, though registration accepts 6 — so
 *     the hint states the floor that applies here rather than reusing signup's.
 *  2. Success revokes **every** session and refresh token the account holds. If
 *     someone is signed in on this browser, their session is dead by the time the
 *     response lands; the screen signs out locally instead of leaving a token that
 *     will fail its next request with no explanation.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuth()

  const handoff = (location.state as ResetHandoff | null) ?? null

  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState<ReadonlySet<'code' | 'password'>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  const errors = {
    code: validateResetCode(code),
    password: validateNewPassword(password),
  }
  const complete = !errors.code && !errors.password
  const errorFor = (field: 'code' | 'password') => (touched.has(field) ? errors[field] : undefined)

  function markTouched(field: 'code' | 'password') {
    setTouched((current) => new Set(current).add(field))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setTouched(new Set<'code' | 'password'>(['code', 'password']))
    setRefusal(null)
    if (!complete) return

    setSubmitting(true)
    try {
      await api.postAnonymous<ResetPasswordResponse>('/auth/reset-password', {
        token: normaliseResetCode(code),
        newPassword: password,
      })

      // Every session is revoked server-side, this one included. Ending it here
      // keeps the local state honest about that.
      logout()

      const identifier = handoff?.identifier ?? ''
      // The sign-in screen's field is an email address. Carrying a phone number
      // into it would put the wrong kind of value in front of the user.
      const email = identifier.includes('@') ? identifier : undefined
      navigate('/auth/login', { replace: true, state: { email, reset: true } })
    } catch (cause) {
      // `invalid or expired reset token` and `account is deactivated` are the
      // service's own words and say exactly what went wrong, so they pass through.
      setRefusal(
        cause instanceof ApiError
          ? cause.message
          : 'Could not reset your password. Check your connection and try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const masked = handoff?.identifier ? maskIdentifier(handoff.identifier) : ''

  return (
    <div className="grid min-h-screen bg-base lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden flex-col justify-between bg-surface p-10 lg:flex">
        <div className="flex items-center gap-2">
          <Shield className="size-7 text-signal" aria-hidden />
          <span className="text-base font-bold tracking-wide text-ink">NATIVITY GUARD</span>
        </div>
        <div>
          <h1 className="max-w-md text-3xl font-semibold leading-tight text-ink">
            Every report answered. Every case accounted for.
          </h1>
          <p className="mt-3 max-w-md text-sm text-ink-muted">
            Choosing a new password signs out every device on your account. Sign back in with the
            new one.
          </p>
        </div>
        <p className="text-xs text-ink-faint">
          Authorised personnel only. Activity on this system is recorded.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <Shield className="size-6 text-signal" aria-hidden />
            <span className="text-sm font-bold tracking-wide text-ink">NATIVITY GUARD</span>
          </div>

          <h2 className="text-xl font-semibold text-ink">Enter your reset code</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {handoff?.sent && masked ? (
              <>
                If an account matches <span className="text-ink">{masked}</span>, the code has gone
                to the phone number and email on it. It expires in {RESET_CODE_TTL_MINUTES} minutes.
              </>
            ) : (
              <>
                Enter the {RESET_CODE_LENGTH}-digit code from your message and choose a new
                password. Codes expire after {RESET_CODE_TTL_MINUTES} minutes.
              </>
            )}
          </p>

          <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <Field label="Reset code" required error={errorFor('code')}>
              {(props) => (
                <Input
                  {...props}
                  // `one-time-code` lets a phone offer the SMS code above the keyboard.
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={RESET_CODE_LENGTH + 2}
                  autoFocus
                  required
                  className="tabular tracking-[0.3em]"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value)
                    setRefusal(null)
                  }}
                  onBlur={() => markTouched('code')}
                />
              )}
            </Field>

            <Field
              label="New password"
              required
              hint={`At least ${MIN_RESET_PASSWORD_LENGTH} characters.`}
              error={errorFor('password')}
            >
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setRefusal(null)
                  }}
                  onBlur={() => markTouched('password')}
                />
              )}
            </Field>

            {refusal ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn"
              >
                <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
                <span>{refusal}</span>
              </p>
            ) : null}

            <Button type="submit" variant="primary" size="lg" block loading={submitting}>
              Set new password
            </Button>
          </form>

          {USE_MOCKS ? (
            <p
              role="status"
              className="mt-4 flex items-start gap-2 rounded-lg border border-border-hi bg-surface-hi px-3 py-2 text-xs text-ink-muted"
            >
              <CheckCircle2 className="mt-px size-4 shrink-0 text-signal" aria-hidden />
              <span>
                Running on mocks — no message is sent. The code is{' '}
                <code className="tabular text-ink">{MOCK_RESET_CODE}</code>.
              </span>
            </p>
          ) : null}

          <p className="mt-8 text-sm text-ink-muted">
            Didn&rsquo;t get a code?{' '}
            <Link to="/auth/forgot-password" className="text-signal hover:text-signal-ink">
              Send another
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
