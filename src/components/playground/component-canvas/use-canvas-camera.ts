"use client"

import { useCallback, useEffect, useRef, type RefObject } from "react"
import { DEFAULT_CAMERA, clampCamera, fitCamera, zoomAround, type Camera } from "./camera"
import { readStoredCamera, writeStoredCamera } from "./camera-storage"

// Previews and canvas controls keep their native pointer, wheel and key handling.
const PASSTHROUGH = "[data-canvas-preview], [data-canvas-controls]"
const KEY_PAN = 64
const REVEAL_MARGIN = 32

/** True when `target` (or an ancestor below `boundary`) can still scroll in the wheel's direction. */
function canNativelyScroll(target: Element, boundary: Element, dx: number, dy: number) {
  for (let el: Element | null = target; el && el !== boundary; el = el.parentElement) {
    const style = getComputedStyle(el)
    const scrollsY = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight
    const scrollsX = /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth
    if (scrollsY && ((dy < 0 && el.scrollTop > 0) || (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight))) return true
    if (scrollsX && ((dx < 0 && el.scrollLeft > 0) || (dx > 0 && el.scrollLeft + el.clientWidth < el.scrollWidth))) return true
  }
  return false
}

/**
 * Pan/zoom camera for the canvas viewport. The transform is written straight
 * to the world element at most once per animation frame; React never
 * re-renders on camera moves.
 */
export function useCanvasCamera(
  viewportRef: RefObject<HTMLDivElement | null>,
  worldRef: RefObject<HTMLDivElement | null>,
  zoomLabelRef: RefObject<HTMLSpanElement | null>
) {
  const camera = useRef<Camera>(DEFAULT_CAMERA)
  const frame = useRef<number | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setCamera = useCallback((next: Camera) => {
    camera.current = clampCamera(next)
    if (frame.current === null) {
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        const { x, y, zoom } = camera.current
        if (worldRef.current) worldRef.current.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`
        if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${Math.round(zoom * 100)}%`
      })
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => writeStoredCamera(camera.current), 300)
  }, [worldRef, zoomLabelRef])

  const viewportSize = useCallback(() => {
    const el = viewportRef.current
    return { width: el?.clientWidth ?? 0, height: el?.clientHeight ?? 0 }
  }, [viewportRef])

  const fit = useCallback(() => {
    const world = worldRef.current
    if (!world) return
    // offsetWidth/Height are layout sizes, unaffected by the transform.
    setCamera(fitCamera({ width: world.offsetWidth, height: world.offsetHeight }, viewportSize()))
  }, [setCamera, viewportSize, worldRef])

  const reset = useCallback(() => setCamera(DEFAULT_CAMERA), [setCamera])

  const zoomBy = useCallback((factor: number) => {
    const { width, height } = viewportSize()
    setCamera(zoomAround(camera.current, factor, width / 2, height / 2))
  }, [setCamera, viewportSize])

  /** Move the camera so the element is on screen (used for focus and in-canvas links). */
  const reveal = useCallback((target: Element, center = false) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const view = viewport.getBoundingClientRect()
    const rect = target.getBoundingClientRect()
    let dx = 0
    let dy = 0
    if (center) {
      dx = view.left + view.width / 2 - (rect.left + rect.width / 2)
      dy = view.top + REVEAL_MARGIN * 2 - rect.top
    } else {
      if (rect.left < view.left + REVEAL_MARGIN) dx = view.left + REVEAL_MARGIN - rect.left
      else if (rect.right > view.right - REVEAL_MARGIN) dx = view.right - REVEAL_MARGIN - rect.right
      if (rect.top < view.top + REVEAL_MARGIN) dy = view.top + REVEAL_MARGIN - rect.top
      else if (rect.bottom > view.bottom - REVEAL_MARGIN) dy = view.bottom - REVEAL_MARGIN - rect.bottom
    }
    if (dx || dy) setCamera({ ...camera.current, x: camera.current.x + dx, y: camera.current.y + dy })
  }, [setCamera, viewportRef])

  // Initial camera: the saved one, or a fit once the world's layout has settled.
  useEffect(() => {
    const world = worldRef.current
    if (!world) return
    const stored = readStoredCamera()
    setCamera(stored ?? DEFAULT_CAMERA)
    if (stored) return

    let settle: number | null = null
    let fitted = false
    const observer = new ResizeObserver(() => {
      if (fitted || world.offsetWidth === 0) return
      if (settle !== null) cancelAnimationFrame(settle)
      // Two frames: let fonts and wrapped rows finish before measuring.
      settle = requestAnimationFrame(() => {
        settle = requestAnimationFrame(() => {
          settle = null
          fitted = true
          fit()
          observer.disconnect()
        })
      })
    })
    observer.observe(world)
    return () => {
      observer.disconnect()
      if (settle !== null) cancelAnimationFrame(settle)
    }
  }, [fit, setCamera, worldRef])

  // Pointer, wheel, keyboard and focus handling on the viewport.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const pointers = new Map<number, { x: number; y: number }>()

    const endAll = () => {
      for (const id of pointers.keys()) {
        if (viewport.hasPointerCapture(id)) viewport.releasePointerCapture(id)
      }
      pointers.clear()
      viewport.removeAttribute("data-panning")
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest(PASSTHROUGH)) return
      if (event.pointerType === "mouse" && event.button !== 0 && event.button !== 1) return
      if (event.button === 1) event.preventDefault() // no autoscroll on middle-click pan
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      viewport.setPointerCapture(event.pointerId)
      viewport.setAttribute("data-panning", "")
    }

    const onPointerMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId)
      if (!previous) return
      const current = { x: event.clientX, y: event.clientY }

      if (pointers.size === 1) {
        pointers.set(event.pointerId, current)
        setCamera({ ...camera.current, x: camera.current.x + current.x - previous.x, y: camera.current.y + current.y - previous.y })
        return
      }

      // Pinch: the two first tracked pointers, before and after this move.
      const [a, b] = [...pointers.entries()].slice(0, 2)
      if (!a || !b) return
      const before = [a[1], b[1]]
      pointers.set(event.pointerId, current)
      const after = [pointers.get(a[0])!, pointers.get(b[0])!]
      const distance = (p: { x: number; y: number }[]) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)
      const middle = (p: { x: number; y: number }[]) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 })
      const view = viewport.getBoundingClientRect()
      const m0 = middle(before)
      const m1 = middle(after)
      const d0 = distance(before)
      const factor = d0 > 0 ? distance(after) / d0 : 1
      const zoomed = zoomAround(camera.current, factor, m1.x - view.left, m1.y - view.top)
      setCamera({ ...zoomed, x: zoomed.x + m1.x - m0.x, y: zoomed.y + m1.y - m0.y })
    }

    const onPointerEnd = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId)
      if (pointers.size === 0) viewport.removeAttribute("data-panning")
    }

    const onWheel = (event: WheelEvent) => {
      if (!(event.target instanceof Element)) return
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1
      const dx = event.deltaX * unit
      const dy = event.deltaY * unit
      const zooming = event.ctrlKey || event.metaKey // also trackpad pinch
      if (!zooming && event.target.closest(PASSTHROUGH) && canNativelyScroll(event.target, viewport, dx, dy)) return
      event.preventDefault()
      if (zooming) {
        const view = viewport.getBoundingClientRect()
        setCamera(zoomAround(camera.current, Math.exp(-dy * 0.01), event.clientX - view.left, event.clientY - view.top))
      } else {
        setCamera({ ...camera.current, x: camera.current.x - dx, y: camera.current.y - dy })
      }
    }

    // Shortcuts apply only while the canvas shell itself has focus.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target !== viewport || event.altKey || event.ctrlKey || event.metaKey) return
      const step = event.shiftKey ? KEY_PAN * 4 : KEY_PAN
      const pan: Record<string, [number, number]> = {
        ArrowLeft: [step, 0],
        ArrowRight: [-step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      }
      if (pan[event.key]) {
        const [dx, dy] = pan[event.key]
        setCamera({ ...camera.current, x: camera.current.x + dx, y: camera.current.y + dy })
      } else if (event.key === "+" || event.key === "=") zoomBy(1.2)
      else if (event.key === "-" || event.key === "_") zoomBy(1 / 1.2)
      else if (event.key === "0") reset()
      else if (event.key.toLowerCase() === "f") fit()
      else return
      event.preventDefault()
    }

    // Keyboard focus that lands off screen pulls the camera to it.
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target !== viewport && worldRef.current?.contains(event.target)) {
        reveal(event.target)
      }
    }

    // The viewport is overflow:hidden; undo any native scroll (e.g. focus scrollIntoView).
    const onScroll = () => {
      viewport.scrollTop = 0
      viewport.scrollLeft = 0
    }

    // Links: "#id" targets inside the canvas move the camera; links that would
    // leave the canvas are not followed. Portaled links are outside this element.
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null
      if (!link || !viewport.contains(link)) return
      event.preventDefault()
      const href = link.getAttribute("href") ?? ""
      const target = href.startsWith("#") ? worldRef.current?.querySelector(`[id="${CSS.escape(href.slice(1))}"]`) : null
      if (target) reveal(target, true)
    }

    const onVisibility = () => {
      if (document.visibilityState === "hidden") endAll()
    }

    viewport.addEventListener("pointerdown", onPointerDown)
    viewport.addEventListener("pointermove", onPointerMove)
    viewport.addEventListener("pointerup", onPointerEnd)
    viewport.addEventListener("pointercancel", onPointerEnd)
    viewport.addEventListener("lostpointercapture", onPointerEnd)
    viewport.addEventListener("wheel", onWheel, { passive: false })
    viewport.addEventListener("keydown", onKeyDown)
    viewport.addEventListener("focusin", onFocusIn)
    viewport.addEventListener("scroll", onScroll)
    viewport.addEventListener("click", onClick)
    window.addEventListener("blur", endAll)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      endAll()
      viewport.removeEventListener("pointerdown", onPointerDown)
      viewport.removeEventListener("pointermove", onPointerMove)
      viewport.removeEventListener("pointerup", onPointerEnd)
      viewport.removeEventListener("pointercancel", onPointerEnd)
      viewport.removeEventListener("lostpointercapture", onPointerEnd)
      viewport.removeEventListener("wheel", onWheel)
      viewport.removeEventListener("keydown", onKeyDown)
      viewport.removeEventListener("focusin", onFocusIn)
      viewport.removeEventListener("scroll", onScroll)
      viewport.removeEventListener("click", onClick)
      window.removeEventListener("blur", endAll)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [fit, reset, reveal, setCamera, viewportRef, worldRef, zoomBy])

  // Teardown: pending frame and save.
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      writeStoredCamera(camera.current)
    }
  }, [])

  return { fit, reset, zoomBy }
}
