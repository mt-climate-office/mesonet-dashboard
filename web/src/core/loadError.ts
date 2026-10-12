/**
 * The text of a view's error state (partials/load-error.html): what could
 * not be loaded and why, in plain words, from the error a fetch threw.
 */
import { HttpError, TimeoutError } from './api/http'

export type LoadErrorKind = 'timeout' | 'busy' | 'server' | 'refused' | 'network'

/** Why a request failed: timed out, rate limited (429), a server error (5xx), refused (other 4xx), or no answer at all. */
export function loadErrorKind(err: unknown): LoadErrorKind {
  if (err instanceof TimeoutError) return 'timeout'
  if (err instanceof HttpError) return err.status === 429 ? 'busy' : err.status >= 500 ? 'server' : 'refused'
  return 'network'
}

const REASONS: Record<LoadErrorKind, string> = {
  timeout: 'the server took too long to answer',
  busy: 'the server is busy',
  server: 'the server had a problem',
  refused: 'the server refused the request',
  network: 'the server could not be reached',
}

/** "<what> could not be loaded: <reason>." (`what` starts with a capital, e.g. "This chart"). */
export function loadErrorText(what: string, err: unknown): string {
  return `${what} could not be loaded: ${REASONS[loadErrorKind(err)]}.`
}
