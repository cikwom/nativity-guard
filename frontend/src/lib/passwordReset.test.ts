import { describe, expect, it } from 'vitest'
import {
  MIN_RESET_PASSWORD_LENGTH,
  RESET_CODE_LENGTH,
  maskIdentifier,
  normaliseResetCode,
  validateIdentifier,
  validateNewPassword,
  validateResetCode,
} from './passwordReset'

describe('normaliseResetCode', () => {
  it('keeps a plain code as typed', () => {
    expect(normaliseResetCode('123456')).toBe('123456')
  })

  it('strips the spacing a handset may have added', () => {
    // Codes arrive as "123 456" or "123-456" depending on the device. Refusing a
    // correctly-copied code over its punctuation is undiagnosable by the user.
    expect(normaliseResetCode('123 456')).toBe('123456')
    expect(normaliseResetCode('123-456')).toBe('123456')
    expect(normaliseResetCode(' 123456 ')).toBe('123456')
  })

  it('drops letters rather than passing them through', () => {
    expect(normaliseResetCode('12a34b56')).toBe('123456')
  })
})

describe('validateIdentifier', () => {
  it('requires a value', () => {
    expect(validateIdentifier('')).toBe('Enter your email address or phone number.')
    expect(validateIdentifier('   ')).toBe('Enter your email address or phone number.')
  })

  it('accepts an email address', () => {
    expect(validateIdentifier('ada@example.com')).toBeUndefined()
  })

  it('rejects a malformed email', () => {
    expect(validateIdentifier('ada@example')).toBe('That does not look like an email address.')
  })

  it('accepts a phone number in any of the shapes people type', () => {
    expect(validateIdentifier('08031112222')).toBeUndefined()
    expect(validateIdentifier('+234 803 111 2222')).toBeUndefined()
    expect(validateIdentifier('0803-111-2222')).toBeUndefined()
  })

  it('rejects a phone number too short to be one', () => {
    // Deliberately lenient: `RequestReset` matches on digits alone, so a stricter
    // rule here could refuse a number the server would have matched — locking
    // someone out of the only flow that could recover their account.
    expect(validateIdentifier('08031')).toBe('That does not look like a phone number.')
  })
})

describe('validateResetCode', () => {
  it('requires a code', () => {
    expect(validateResetCode('')).toBe('Enter the code from your message.')
  })

  it('requires the full length', () => {
    expect(validateResetCode('12345')).toBe(`The code is ${RESET_CODE_LENGTH} digits.`)
    expect(validateResetCode('1234567')).toBe(`The code is ${RESET_CODE_LENGTH} digits.`)
  })

  it('accepts a code that was pasted with spacing', () => {
    expect(validateResetCode('123 456')).toBeUndefined()
  })
})

describe('validateNewPassword', () => {
  it('requires a password', () => {
    expect(validateNewPassword('')).toBe('Choose a new password.')
  })

  it('enforces the reset floor, which is higher than the signup floor', () => {
    // Registration binds min=6; `ResetPassword` binds min=8 and `ResetWithToken`
    // refuses anything shorter again. Submitting 7 here would be a round trip to
    // be told what this line already knows.
    expect(validateNewPassword('a'.repeat(MIN_RESET_PASSWORD_LENGTH - 1))).toBe(
      `Use at least ${MIN_RESET_PASSWORD_LENGTH} characters.`,
    )
    expect(validateNewPassword('a'.repeat(MIN_RESET_PASSWORD_LENGTH))).toBeUndefined()
  })
})

describe('maskIdentifier', () => {
  it('keeps the domain and the first letter of an address', () => {
    expect(maskIdentifier('ada@example.com')).toBe('a••@example.com')
  })

  it('keeps only the last three digits of a phone number', () => {
    // Built from the rule (13 digits, last three shown) rather than an eyeballed
    // run of bullets, which is impossible to miscount in review.
    expect(maskIdentifier('+2348011110003')).toBe('•'.repeat(10) + '003')
  })

  it('returns nothing for an empty value rather than a row of bullets', () => {
    expect(maskIdentifier('')).toBe('')
  })
})
