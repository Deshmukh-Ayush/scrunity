"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * A filter value kept in the URL (?status=running), so it survives refresh
 * and back. "all" (or a value not in `allowed`) removes the parameter. Other
 * query parameters are kept.
 */
export function useUrlFilter<V extends string>(
  param: string,
  allowed: readonly V[]
) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const raw = searchParams.get(param)
  const value: V | "all" =
    raw && (allowed as readonly string[]).includes(raw) ? (raw as V) : "all"

  const setValue = React.useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === "all" || !(allowed as readonly string[]).includes(next))
        params.delete(param)
      else params.set(param, next)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      })
    },
    [allowed, param, pathname, router, searchParams]
  )

  return [value, setValue] as const
}
