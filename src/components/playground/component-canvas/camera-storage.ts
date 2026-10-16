import { clampCamera, type Camera } from "./camera"

/**
 * Only the camera is saved. Format v1: `{ v: 1, x, y, zoom }`. There is no
 * older format yet; anything unknown, malformed or oversized is ignored and
 * removed so the canvas starts from a fit.
 */
const STORAGE_KEY = "scrunity:component-canvas:camera"
const VERSION = 1
const MAX_BYTES = 512

export function readStoredCamera(): Camera | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    if (raw.length > MAX_BYTES) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { v?: unknown }).v === VERSION
    ) {
      const { x, y, zoom } = parsed as Record<string, unknown>
      if (typeof x === "number" && typeof y === "number" && typeof zoom === "number") {
        return clampCamera({ x, y, zoom })
      }
    }
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  } catch {
    // Storage blocked (private mode, disabled site data) or bad JSON.
    return null
  }
}

export function writeStoredCamera(camera: Camera) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: VERSION, ...camera }))
  } catch {
    // Quota exceeded or storage unavailable: the camera just isn't remembered.
  }
}
