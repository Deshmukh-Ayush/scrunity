"use client"

import * as React from "react"

/**
 * 32px company tile: the real fetched logo when there is one and it loads,
 * otherwise the first letter of the name on the muted fill.
 */
export function CompanyTile({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const [failed, setFailed] = React.useState(false)
  const imgRef = React.useRef<HTMLImageElement>(null)

  // An image that failed before hydration never fires onError for React.
  React.useEffect(() => {
    setFailed(false)
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth === 0) setFailed(true)
  }, [logoUrl])

  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-body font-medium text-fg-default"
    >
      {logoUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- logos from many hosts
        <img ref={imgRef} src={logoUrl} alt="" className="size-full object-contain p-1" onError={() => setFailed(true)} />
      ) : (
        (name.trim().charAt(0) || "?").toUpperCase()
      )}
    </span>
  )
}
