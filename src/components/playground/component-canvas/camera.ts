/**
 * Pure camera math for the component canvas. The world is drawn with
 * `translate(x, y) scale(zoom)` from its top-left corner, in viewport pixels.
 */
export interface Camera {
  x: number
  y: number
  zoom: number
}

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 3
const MAX_OFFSET = 100_000

export const DEFAULT_CAMERA: Camera = { x: 48, y: 48, zoom: 1 }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Any non-finite or out-of-range value falls back to a safe default. */
export function clampCamera(camera: Partial<Camera>): Camera {
  const x = Number.isFinite(camera.x) ? clamp(camera.x!, -MAX_OFFSET, MAX_OFFSET) : DEFAULT_CAMERA.x
  const y = Number.isFinite(camera.y) ? clamp(camera.y!, -MAX_OFFSET, MAX_OFFSET) : DEFAULT_CAMERA.y
  const zoom = Number.isFinite(camera.zoom) && camera.zoom! > 0 ? clamp(camera.zoom!, MIN_ZOOM, MAX_ZOOM) : DEFAULT_CAMERA.zoom
  return { x, y, zoom }
}

/** Zoom by `factor`, keeping the viewport point (px, py) fixed on screen. */
export function zoomAround(camera: Camera, factor: number, px: number, py: number): Camera {
  const zoom = clamp(camera.zoom * factor, MIN_ZOOM, MAX_ZOOM)
  const k = zoom / camera.zoom
  return clampCamera({ zoom, x: px - (px - camera.x) * k, y: py - (py - camera.y) * k })
}

/** Fit the whole world inside the viewport, never zooming in past 100%. */
export function fitCamera(
  world: { width: number; height: number },
  viewport: { width: number; height: number },
  padding = 48
): Camera {
  if (world.width <= 0 || world.height <= 0) return DEFAULT_CAMERA
  const zoom = clamp(
    Math.min((viewport.width - padding * 2) / world.width, (viewport.height - padding * 2) / world.height, 1),
    MIN_ZOOM,
    MAX_ZOOM
  )
  return clampCamera({
    zoom,
    x: (viewport.width - world.width * zoom) / 2,
    y: Math.max(padding, (viewport.height - world.height * zoom) / 2),
  })
}
