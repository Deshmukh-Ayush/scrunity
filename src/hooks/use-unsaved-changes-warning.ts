"use client"

import * as React from "react"

/**
 * Asks before leaving a page with unsaved changes: the browser's own prompt
 * on reload or tab close, and a confirm on in-app links (the App Router has
 * no navigation-blocking API, so link clicks are checked in the capture phase).
 */
export function useUnsavedChangesWarning(dirty: boolean, message: string) {
  React.useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const link = e.target instanceof Element ? e.target.closest("a[href]") : null
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") return
      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return
      if (!window.confirm(message)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [dirty, message])
}
