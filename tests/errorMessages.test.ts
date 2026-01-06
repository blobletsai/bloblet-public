import { describe, expect, it } from 'vitest'
import { getUserFriendlyError } from '../src/shared/errorMessages'

describe('getUserFriendlyError', () => {
  it('maps known errors to friendly messages', () => {
    expect(getUserFriendlyError('unauthorized')).toBe('Please verify your wallet first')
    expect(getUserFriendlyError('rate limited')).toBe('Too many requests. Please wait a moment')
  })

  it('capitalizes unknown errors', () => {
    expect(getUserFriendlyError('unexpected failure')).toBe('Unexpected failure')
  })

  it('uses fallback when error is missing', () => {
    expect(getUserFriendlyError(undefined, 500)).toBe('Request failed (500)')
    expect(getUserFriendlyError(undefined)).toBe('Request failed')
  })
})
