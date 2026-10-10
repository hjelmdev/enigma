/**
 * Accepts a tap on a game object only when the same pointer both pressed and
 * released on it.
 *
 * Why: Phaser listens for pointer release on `window` (to support release
 * outside the canvas) and then hit-tests the release position against game
 * objects. Pressing an HTML overlay button (e.g. a caption's "Fortsätt")
 * never reaches the canvas, but its release does, so an object lying under
 * the button received a stray `pointerup`: a tablet behind the caption
 * opened its own caption, a token behind it jumped to the pan, a tile slid.
 */
export class TapGuard {
  private armed = new Map<string, number>();

  down(objectId: string, pointerId: number) {
    this.armed.set(objectId, pointerId);
  }

  /** True only for a release that completes a press on the same object. */
  up(objectId: string, pointerId: number) {
    const ok = this.armed.get(objectId) === pointerId;
    this.armed.delete(objectId);
    return ok;
  }

  /** Forget presses (e.g. when a dialog opens or the pointer leaves). */
  clear() {
    this.armed.clear();
  }
}
