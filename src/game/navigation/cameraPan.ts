export interface HorizontalWorldBounds {
  x: number;
  width: number;
}

export const TAP_SWIPE_THRESHOLD = 14;

/** A slightly diagonal swipe still counts as horizontal camera movement. */
export function isHorizontalSwipe(deltaX: number, deltaY: number) {
  return (
    Math.hypot(deltaX, deltaY) >= TAP_SWIPE_THRESHOLD &&
    Math.abs(deltaX) >= Math.abs(deltaY) * 0.55
  );
}

export function clampCameraScrollX(
  scrollX: number,
  bounds: HorizontalWorldBounds,
  viewportWidth: number,
  zoom: number,
) {
  const visibleWorldWidth = viewportWidth / zoom;
  const min = bounds.x;
  const max = Math.max(min, bounds.x + bounds.width - visibleWorldWidth);
  return Math.min(max, Math.max(min, scrollX));
}

export function getHorizontalPanAvailability(
  scrollX: number,
  bounds: HorizontalWorldBounds,
  viewportWidth: number,
  zoom: number,
) {
  const visibleWorldWidth = viewportWidth / zoom;
  const min = bounds.x;
  const max = Math.max(min, bounds.x + bounds.width - visibleWorldWidth);
  return { left: scrollX > min + 1, right: scrollX < max - 1 };
}
