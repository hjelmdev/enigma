import { CHANNEL, ROOM, ROOM_H, ROOM_W, VIEW } from '../layout.ts';

/**
 * The gold-inlaid groove in the floor that runs from the seal stand to the
 * door threshold. It is baked into the room as a dull inlay (so players can
 * see the stand and door are connected) and lit pixel by pixel, in order of
 * `t`, when the seal is solved.
 */
export interface ChannelPixel {
  x: number;
  y: number;
  /** 0 at the stand, 1 at the door. */
  t: number;
  /** Centre line of the groove (brighter when lit). */
  core: boolean;
}

const HALF_WIDTH = 0.075;

export function computeChannel(): ChannelPixel[] {
  const lengths: number[] = [0];
  for (let i = 1; i < CHANNEL.length; i++) {
    const a = CHANNEL[i - 1];
    const b = CHANNEL[i];
    lengths.push(lengths[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const total = lengths[lengths.length - 1];
  const out: ChannelPixel[] = [];
  for (let sy = Math.ceil(VIEW.vy); sy < ROOM_H; sy++) {
    for (let sx = 0; sx < ROOM_W; sx++) {
      const dy = (sy + 0.5 - VIEW.vy) / VIEW.focal;
      const z = ROOM.floorY / dy;
      if (z > ROOM.backZ) continue;
      const x = ((sx + 0.5 - VIEW.vx) / VIEW.focal) * z;
      let best = Infinity;
      let bestT = 0;
      for (let i = 1; i < CHANNEL.length; i++) {
        const a = CHANNEL[i - 1];
        const b = CHANNEL[i];
        const vx = b.x - a.x;
        const vz = b.z - a.z;
        const len2 = vx * vx + vz * vz;
        const u = Math.max(
          0,
          Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / len2),
        );
        const d = Math.hypot(x - (a.x + vx * u), z - (a.z + vz * u));
        if (d < best) {
          best = d;
          bestT = (lengths[i - 1] + u * Math.sqrt(len2)) / total;
        }
      }
      if (best < HALF_WIDTH)
        out.push({ x: sx, y: sy, t: bestT, core: best < HALF_WIDTH * 0.45 });
    }
  }
  return out;
}
