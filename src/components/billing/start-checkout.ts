import { toast } from "sonner"

/**
 * POSTs a checkout action and follows the result: dev-simulated checkouts show
 * `simulatedMessage` and reload; real ones redirect to the Dodo checkout URL.
 * Returns true when the dialog that started it should close. Throws the route's
 * error message on failure.
 */
export async function startCheckout(
  body: Record<string, unknown>,
  {
    fallbackError,
    simulatedMessage,
  }: { fallbackError: string; simulatedMessage: string }
): Promise<boolean> {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || fallbackError)

  if (data.devSimulated) {
    toast.success(simulatedMessage)
    window.location.reload()
    return true
  }
  if (data.url) window.location.href = data.url
  return false
}
