/**
 * Retry policy shared by every fetch (used by core/cache.ts): retry network
 * failures and timeouts (http.ts `TimeoutError`), 5xx and 429 (rate limited: it clears after a pause), never other
 * 4xx — a bad request will not succeed on retry.
 */
import { HttpError } from './http'

/** Retries after the first attempt. */
export const MAX_RETRIES = 2

/** True when `error` (from attempt number `attempt`, 1-based) deserves another try. */
export function shouldRetry(error: unknown, attempt: number): boolean {
  if (attempt > MAX_RETRIES) return false
  if (error instanceof HttpError) return error.status >= 500 || error.status === 429
  // Aborts are deliberate; anything else (TypeError: Failed to fetch, TimeoutError, …) is network.
  return !(error instanceof DOMException && error.name === 'AbortError')
}

/** Backoff before retry `attempt` (1-based), ms: 500, 1000, … capped at 4 s. */
export const retryDelayMs = (attempt: number): number => Math.min(4000, 500 * 2 ** (attempt - 1))
