/**
 * Password recovery rules, as pure functions.
 *
 * The flow is a **code**, not a link. Two things read off the backend decide the
 * shape of everything here:
 *
 *  1. `generateResetCode` mints exactly six digits, and both notifiers put that
 *     code in the body of the message. `ForgotPassword`'s 200 still says "we've
 *     sent a password reset link" — stale copy the screens do not repeat, because
 *     someone told to expect a link waits for one that never arrives while the
 *     code sits in the SMS or email they already have.
 *  2. `ResetPassword` binds `newPassword` with `min=8` and `ResetWithToken`
 *     refuses anything shorter a second time. Registration accepts **6**. That
 *     asymmetry belongs to the backend and is reported rather than smoothed over;
 *     this module states the floor that applies *here*.
 */

/** `ResetPassword` binds `newPassword` with `min=8`; `ResetWithToken` enforces it again. */
export const MIN_RESET_PASSWORD_LENGTH = 8

/** `generateResetCode` produces exactly this many digits. */
export const RESET_CODE_LENGTH = 6

/** `defaultResetTokenTTL` — quoted in the copy so the deadline is not a surprise. */
export const RESET_CODE_TTL_MINUTES = 60

/**
 * Strip whatever a paste brought with it. Codes arrive as `123456`, `123 456` or
 * `123-456` depending on the handset, and refusing a correctly-copied code over
 * its spacing is a failure the user cannot diagnose.
 */
export function normaliseResetCode(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * The backend dispatches on `strings.Contains(identifier, "@")`, so the same test
 * decides which shape to check for here.
 *
 * Phone is deliberately lenient. `RequestReset` compares `removeNonDigits` against
 * the stored column and registration accepts whatever was typed, so any stricter
 * rule risks refusing a number the server would have matched — locking someone out
 * of the only flow that could have recovered their account. The digits floor only
 * catches obvious typos.
 */
export function validateIdentifier(value: string): string | undefined {
  const identifier = value.trim()
  if (!identifier) return 'Enter your email address or phone number.'

  if (identifier.includes('@')) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)
      ? undefined
      : 'That does not look like an email address.'
  }

  return normaliseResetCode(identifier).length >= 7
    ? undefined
    : 'That does not look like a phone number.'
}

export function validateResetCode(value: string): string | undefined {
  const code = normaliseResetCode(value)
  if (!code) return 'Enter the code from your message.'
  if (code.length !== RESET_CODE_LENGTH) {
    return `The code is ${RESET_CODE_LENGTH} digits.`
  }
  return undefined
}

export function validateNewPassword(value: string): string | undefined {
  if (!value) return 'Choose a new password.'
  if (value.length < MIN_RESET_PASSWORD_LENGTH) {
    return `Use at least ${MIN_RESET_PASSWORD_LENGTH} characters.`
  }
  return undefined
}

/**
 * What to show back when confirming a code was sent.
 *
 * Echoing the identifier is not a disclosure — it is what the person just typed.
 * Masking it keeps a shoulder-surfer from reading an address off the screen, and
 * the copy stays conditional ("if an account matches"), which is the same
 * non-enumeration the endpoint enforces.
 */
export function maskIdentifier(value: string): string {
  const identifier = value.trim()
  if (!identifier) return ''

  if (identifier.includes('@')) {
    const [local, domain] = identifier.split('@')
    if (!local || !domain) return identifier
    const head = local.slice(0, 1)
    return `${head}${'•'.repeat(Math.max(local.length - 1, 2))}@${domain}`
  }

  const digits = normaliseResetCode(identifier)
  if (digits.length <= 3) return identifier
  return `${'•'.repeat(digits.length - 3)}${digits.slice(-3)}`
}
