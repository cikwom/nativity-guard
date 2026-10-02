import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, Shield } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { api, ApiError } from '@/lib/apiClient'
import { RESET_CODE_TTL_MINUTES, validateIdentifier } from '@/lib/passwordReset'
import type { ForgotPasswordResponse } from '@/types/api'

/**
 * Step one of recovery: name the account.
 *
 * `POST /auth/forgot-password` answers 200 whatever you send — an unknown
 * identifier is a deliberate silent no-op, so this screen cannot tell the user
 * whether the account exists and does not try. Its own message says a "reset link"
 * was sent; a 6-digit code is what actually arrives, so the copy here says code.
 *
 * The response is not shown, only the fact that the request was accepted. Passing
 * the identifier forward lets the next screen say where the code went without
 * asking for it twice.
 */
export function ForgotPasswordPage() {
  const navigate = useNavigate()

  const [identifier, setIdentifier] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  const error = validateIdentifier(identifier)
  const errorForField = touched ? error : undefined

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    setRefusal(null)
    if (error) return

    setSubmitting(true)
    try {
      await api.postAnonymous<ForgotPasswordResponse>('/auth/forgot-password', {
        identifier: identifier.trim(),
      })
      navigate('/auth/reset-password', {
        replace: true,
        state: { identifier: identifier.trim(), sent: true },
      })
    } catch (cause) {
      // A 500 here is the service failing, not a verdict on the account — the
      // distinction matters, so the message reports the failure and nothing else.
      setRefusal(
        cause instanceof ApiError
          ? cause.message
          : 'Could not send the code. Check your connection and try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

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
            Forgot your password? We will send a one-time code to the phone number and email
            already on your account.
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

          <h2 className="text-xl font-semibold text-ink">Reset your password</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Enter the email address or phone number on your account and we will send a one-time
            code. It expires in {RESET_CODE_TTL_MINUTES} minutes.
          </p>

          <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
            <Field
              label="Email or phone number"
              required
              hint="Either one works — use whichever your account has."
              error={errorForField}
            >
              {(props) => (
                <Input
                  {...props}
                  type="text"
                  autoComplete="username"
                  autoFocus
                  required
                  value={identifier}
                  onChange={(event) => {
                    setIdentifier(event.target.value)
                    setRefusal(null)
                  }}
                  onBlur={() => setTouched(true)}
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
              Send reset code
            </Button>
          </form>

          <p className="mt-8 text-sm text-ink-muted">
            Remembered it?{' '}
            <Link to="/auth/login" className="text-signal hover:text-signal-ink">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
