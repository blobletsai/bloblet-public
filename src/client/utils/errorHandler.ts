/**
 * Centralized error handler for fetch requests
 * Provides consistent error messages and handling across the application
 */

export type ErrorResult = {
  message: string
  isTimeout: boolean
  isNetwork: boolean
  isServerError: boolean
  statusCode?: number
}

/**
 * Creates an AbortController with a timeout
 * @param timeoutMs Timeout in milliseconds (default: 30000)
 * @returns Object with controller and cleanup function
 */
export function createAbortController(timeoutMs: number = 30000): {
  controller: AbortController
  timeoutId: number
  cleanup: () => void
} {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
  const cleanup = () => window.clearTimeout(timeoutId)
  return { controller, timeoutId, cleanup }
}

/**
 * Handles fetch errors and provides user-friendly error messages
 * @param error The error object from catch block
 * @param response Optional response object if available
 * @param defaultMessage Default message if error can't be parsed
 * @returns ErrorResult with message and error metadata
 */
export function handleFetchError(
  error: unknown,
  response?: Response,
  defaultMessage: string = 'Request failed. Please try again.',
): ErrorResult {
  const result: ErrorResult = {
    message: defaultMessage,
    isTimeout: false,
    isNetwork: false,
    isServerError: false,
  }

  // Handle Response errors (HTTP status codes)
  if (response && !response.ok) {
    result.statusCode = response.status

    // Server errors (5xx)
    if (response.status >= 500) {
      result.isServerError = true
      result.message = 'Server error. Please try again in a few moments.'
      return result
    }

    // Specific client errors
    if (response.status === 402) {
      result.message = 'Insufficient BlobCoin for this action.'
      return result
    }

    if (response.status === 401) {
      result.message = 'Authentication required. Please connect and verify your wallet.'
      return result
    }

    if (response.status === 403) {
      result.message = 'Access denied. Holder verification required.'
      return result
    }

    if (response.status === 404) {
      result.message = 'Resource not found.'
      return result
    }

    if (response.status === 429) {
      result.message = 'Too many requests. Please wait a moment and try again.'
      return result
    }

    if (response.status === 503) {
      result.message = 'Service temporarily unavailable. Try again in a moment.'
      return result
    }

    // Generic 4xx error
    result.message = `Request failed (${response.status}). Please try again.`
    return result
  }

  // Handle Error instances
  if (error instanceof Error) {
    // Timeout errors (AbortError)
    if (error.name === 'AbortError') {
      result.isTimeout = true
      result.message = 'Request timed out. Please try again.'
      return result
    }

    // Network errors
    if (
      error.message?.toLowerCase().includes('fetch') ||
      error.message?.toLowerCase().includes('network') ||
      error.name === 'TypeError'
    ) {
      result.isNetwork = true
      result.message = 'Network error. Check your connection and try again.'
      return result
    }

    // Use the error message if available
    if (error.message) {
      result.message = error.message
      return result
    }
  }

  // Fallback to default message
  return result
}

/**
 * Parses JSON from response safely
 * @param response Fetch Response object
 * @returns Parsed JSON or null
 */
export async function safeParseJson<T = any>(response: Response): Promise<T | null> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/**
 * Gets error message from response JSON
 * @param json Parsed JSON response
 * @param fallback Fallback message
 * @returns Error message string
 */
export function getErrorFromJson(
  json: any,
  fallback: string = 'Request failed. Please try again.',
): string {
  if (typeof json?.error === 'string' && json.error.trim()) {
    return json.error.trim()
  }
  if (typeof json?.message === 'string' && json.message.trim()) {
    return json.message.trim()
  }
  return fallback
}

/**
 * Complete fetch wrapper with error handling and timeout
 * @param url Request URL
 * @param options Fetch options
 * @param timeoutMs Timeout in milliseconds (default: 30000)
 * @returns Response object
 * @throws ErrorResult on failure
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000,
): Promise<Response> {
  const { controller, cleanup } = createAbortController(timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    cleanup()
    return response
  } catch (error) {
    cleanup()
    const errorResult = handleFetchError(error, undefined, `Request to ${url} failed`)
    throw errorResult
  }
}
