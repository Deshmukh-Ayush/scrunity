/** Plans the admin may grant (mirrors GRANTABLE_PLANS in lib/pilot/invites.ts). */
export const PLAN_OPTIONS = ["pilot", "starter", "growth", "scale"] as const

export const selectClassName =
  "h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** POSTs/DELETEs JSON and throws the API's error message on failure. */
export async function adminRequest<T = unknown>(url: string, method: "POST" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data as T
}
