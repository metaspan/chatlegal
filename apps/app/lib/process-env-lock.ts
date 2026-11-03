/**
 * Serialises tests that write process.env.
 * The runner may overlap files, and those tests share the session override
 * and the matter database URL.
 */

let tail: Promise<void> = Promise.resolve()

export function withProcessEnvLock<T>(run: () => Promise<T>): Promise<T> {
  const result = tail.then(run, run)
  tail = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}
