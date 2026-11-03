/**
 * How long a centre-pane send waits before it is treated as timed out.
 * No environment variable. The composer then keeps the text and tries again.
 */

export const MESSAGE_SEND_TIMEOUT_MS = 20_000

export function isSendTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String((error as { name: unknown }).name) : ''
  if (name === 'TimeoutError') return true
  if (name === 'AbortError') {
    const message = 'message' in error ? String((error as { message: unknown }).message) : ''
    return /timeout/i.test(message)
  }
  return false
}

export function sendAbortSignal(ms = MESSAGE_SEND_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms)
}
