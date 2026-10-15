"use client"

import { useRef, type ReactNode } from "react"
import { useTheme } from "next-themes"
import { Maximize, Minus, Moon, Plus, RotateCcw, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useHydrated } from "@/hooks/use-hydrated"
import { useCanvasCamera } from "./use-canvas-camera"

/**
 * Full-viewport pan/zoom canvas. Groups are laid out in normal flow inside the
 * world element, so they never overlap; the camera only transforms the world.
 */
export function ComponentCanvas({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const zoomLabelRef = useRef<HTMLSpanElement>(null)
  const { fit, reset, zoomBy } = useCanvasCamera(viewportRef, worldRef, zoomLabelRef)

  return (
    <div className="fixed inset-0 bg-background text-foreground">
      <div
        ref={viewportRef}
        tabIndex={0}
        role="region"
        aria-label="Component canvas. Arrow keys pan, plus and minus zoom, F fits, 0 resets."
        className="absolute inset-0 cursor-grab touch-none overflow-hidden outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset data-[panning]:cursor-grabbing"
      >
        <div
          ref={worldRef}
          className="absolute top-0 left-0 flex w-[1800px] origin-top-left flex-col gap-20"
        >
          {children}
        </div>
      </div>
      <CanvasToolbar zoomLabelRef={zoomLabelRef} onFit={fit} onReset={reset} onZoom={zoomBy} />
    </div>
  )
}

function CanvasToolbar({
  zoomLabelRef,
  onFit,
  onReset,
  onZoom,
}: {
  zoomLabelRef: React.RefObject<HTMLSpanElement | null>
  onFit: () => void
  onReset: () => void
  onZoom: (factor: number) => void
}) {
  return (
    <div
      data-canvas-controls
      role="toolbar"
      aria-label="Canvas controls"
      className="absolute top-3 right-3 flex items-center gap-1 rounded-lg border bg-background/90 p-1 backdrop-blur"
    >
      <Button variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={() => onZoom(1 / 1.2)}>
        <Minus />
      </Button>
      <span ref={zoomLabelRef} aria-live="polite" className="w-10 text-center font-mono text-[11px] text-muted-foreground">
        100%
      </span>
      <Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={() => onZoom(1.2)}>
        <Plus />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Fit all groups" onClick={onFit}>
        <Maximize />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Reset camera" onClick={onReset}>
        <RotateCcw />
      </Button>
      <ThemeToggle />
    </div>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const hydrated = useHydrated()
  const isDark = hydrated && resolvedTheme === "dark"
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  )
}
