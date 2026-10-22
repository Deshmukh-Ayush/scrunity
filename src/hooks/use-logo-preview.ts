import * as React from "react"
import { savedLogoFor, type SavedLogo } from "@/lib/company-profile/form"

/**
 * Logo for the website being typed: shows Google's favicon immediately, then
 * swaps in the og:image/favicon from /api/gtm/fetch-logo after a short debounce.
 * While the website is still the saved profile's, the logo stored with the
 * profile is shown and nothing is fetched (no logo quota on page views).
 */
export function useLogoPreview(
  websiteUrl: string,
  { saved, debounceMs = 600 }: { saved?: SavedLogo | null; debounceMs?: number } = {}
) {
  const storedLogo = savedLogoFor(websiteUrl, saved)
  const [logoPreview, setLogoPreview] = React.useState<string | null>(storedLogo)
  const [isFetchingLogo, setIsFetchingLogo] = React.useState(false)

  React.useEffect(() => {
    if (storedLogo) {
      setLogoPreview(storedLogo)
      return
    }
    const raw = websiteUrl.trim()
    if (!raw || !raw.includes(".")) {
      setLogoPreview(null)
      return
    }

    let domain = raw
    try {
      const cleanHost = raw.replace(/^(?:https?:\/*)+/i, "")
      domain = new URL(`https://${cleanHost}`).hostname.replace(/^www\./, "")
    } catch {
      // keep the raw value as the domain
    }

    setLogoPreview(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`)

    const controller = new AbortController()
    setIsFetchingLogo(true)

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/gtm/fetch-logo?url=${encodeURIComponent(raw)}`,
          {
            signal: controller.signal,
          }
        )
        const data = await res.json()
        if (data.logoUrl) setLogoPreview(data.logoUrl)
      } catch {
        // the favicon fallback stays in place
      } finally {
        setIsFetchingLogo(false)
      }
    }, debounceMs)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [websiteUrl, debounceMs, storedLogo])

  return { logoPreview, isFetchingLogo, clearLogo: () => setLogoPreview(null) }
}
