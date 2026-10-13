/**
 * Converts server data into exactly what the matching API route sends as JSON
 * (Dates become ISO strings, undefined fields drop out). Server components use
 * it when handing initial data to a client component that later refreshes the
 * same data by polling that route, so both sources have one shape.
 *
 * `T` is the client-side type of the JSON payload; the caller vouches for it.
 */
export function asJson<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T
}
