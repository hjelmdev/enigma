export interface WorldBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const TAP_SWIPE_THRESHOLD = 14;
const PAN_FRICTION_MS = 190;

export function isPanGesture(deltaX: number, deltaY: number) {
  return Math.hypot(deltaX, deltaY) >= TAP_SWIPE_THRESHOLD;
}

export function clampCameraScroll(
  scrollX: number,
  scrollY: number,
  bounds: WorldBounds,
  viewportWidth: number,
  viewportHeight: number,
  zoom: number,
) {
  const visibleWorldWidth = viewportWidth / zoom;
  const visibleWorldHeight = viewportHeight / zoom;
  const maxX = Math.max(bounds.x, bounds.x + bounds.width - visibleWorldWidth);
  const maxY = Math.max(
    bounds.y,
    bounds.y + bounds.height - visibleWorldHeight,
  );
  return {
    x: Math.min(maxX, Math.max(bounds.x, scrollX)),
    y: Math.min(maxY, Math.max(bounds.y, scrollY)),
  };
}

export function getPanAvailability(
  scrollX: number,
  scrollY: number,
  bounds: WorldBounds,
  viewportWidth: number,
  viewportHeight: number,
  zoom: number,
) {
  const { x: minX, y: minY, width, height } = bounds;
  const maxX = Math.max(minX, minX + width - viewportWidth / zoom);
  const maxY = Math.max(minY, minY + height - viewportHeight / zoom);
  return {
    left: scrollX > minX + 1,
    right: scrollX < maxX - 1,
    up: scrollY > minY + 1,
    down: scrollY < maxY - 1,
  };
}

export function advancePanMomentum(
  scrollX: number,
  scrollY: number,
  velocityX: number,
  velocityY: number,
  elapsedMs: number,
  bounds: WorldBounds,
  viewportWidth: number,
  viewportHeight: number,
  zoom: number,
) {
  const next = clampCameraScroll(
    scrollX + velocityX * elapsedMs,
    scrollY + velocityY * elapsedMs,
    bounds,
    viewportWidth,
    viewportHeight,
    zoom,
  );
  const hitXEdge = Math.abs(next.x - scrollX) < 0.01;
  const hitYEdge = Math.abs(next.y - scrollY) < 0.01;
  const decay = Math.exp(-elapsedMs / PAN_FRICTION_MS);
  return {
    scrollX: next.x,
    scrollY: next.y,
    velocityX: hitXEdge ? 0 : velocityX * decay,
    velocityY: hitYEdge ? 0 : velocityY * decay,
  };
}
