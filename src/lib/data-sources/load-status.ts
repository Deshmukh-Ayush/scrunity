/**
 * Loading the Data sources status as a result, never a throw or an endless
 * wait: the page renders a loaded card or a clear error card. Pure (no DB),
 * so it is unit-tested with stub loaders.
 */

/** Long enough for a cold Neon start, short enough that nobody waits on a hung query. */
export const DATA_SOURCES_LOAD_TIMEOUT_MS = 15_000

export type LoadFailureReason = "timeout" | "failed"

export type LoadResult<T> = { ok: true; value: T } | { ok: false; reason: LoadFailureReason; detail: string }

/** Postgres SQLSTATE of the error or its cause (Drizzle wraps the driver error), e.g. 42P01 for a missing table. */
function sqlState(err: unknown): string | null {
  for (let e: unknown = err, depth = 0; e && typeof e === "object" && depth < 3; e = (e as { cause?: unknown }).cause, depth++) {
    const code = (e as { code?: unknown }).code
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code
  }
  return null
}

/** A log-safe description: error name and SQLSTATE only, never the query, its params or the message. */
export function describeLoadError(err: unknown): string {
  const name = err instanceof Error ? err.name : "unknown error"
  const code = sqlState(err)
  if (code === "42P01") return `${name} (42P01: table missing; run npm run db:migrate on this database)`
  return code ? `${name} (${code})` : name
}

export async function loadWithTimeout<T>(load: () => Promise<T>, timeoutMs = DATA_SOURCES_LOAD_TIMEOUT_MS): Promise<LoadResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<LoadResult<T>>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reason: "timeout", detail: `no answer after ${timeoutMs} ms` }), timeoutMs)
  })
  try {
    return await Promise.race([
      load().then(
        (value): LoadResult<T> => ({ ok: true, value }),
        (err: unknown): LoadResult<T> => ({ ok: false, reason: "failed", detail: describeLoadError(err) })
      ),
      timeout,
    ])
  } finally {
    clearTimeout(timer)
  }
}
