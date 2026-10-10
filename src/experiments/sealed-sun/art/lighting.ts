import { TORCHES, type Vec3 } from '../layout.ts';

/**
 * One lighting model for every baked layer: two warm torches, a faint cool
 * ambient, and a soft fill from the viewer so near surfaces never drop to
 * flat black. The result is tone-mapped into 0..1 and then quantized into a
 * material ramp, so light, not per-object tinting, decides the value.
 */

export interface PointLight {
  pos: Vec3;
  intensity: number;
  /** Distance at which the light falls to half. */
  reach: number;
}

export const ROOM_LIGHTS: PointLight[] = TORCHES.map((pos) => ({
  pos: { x: pos.x, y: pos.y - 0.45, z: pos.z - 0.55 },
  intensity: 1.9,
  reach: 4.6,
}));

const AMBIENT = 0.075;
const VIEWER_FILL = 0.04;

export function lightAt(
  p: Vec3,
  n: Vec3,
  lights: PointLight[] = ROOM_LIGHTS,
  ambient = AMBIENT,
) {
  let total = ambient;
  for (const light of lights) {
    const dx = light.pos.x - p.x;
    const dy = light.pos.y - p.y;
    const dz = light.pos.z - p.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    const lambert = Math.max(0, (dx * n.x + dy * n.y + dz * n.z) / d);
    // Wrap a little so grazing surfaces still pick up warmth.
    const wrapped = lambert * 0.8 + 0.2 * Math.max(0, lambert + 0.3);
    const falloff = 1 / (1 + (d / light.reach) ** 2);
    total += light.intensity * wrapped * falloff;
  }
  // Viewer fill: light from the eye, fading with depth.
  const vd = Math.hypot(p.x, p.y, p.z) || 1;
  const facing = Math.max(0, -(p.x * n.x + p.y * n.y + p.z * n.z) / vd);
  total += VIEWER_FILL * facing * (1 / (1 + (vd / 11) ** 2)) * 2.2;
  return total;
}

/** Tone map: soft shoulder, keeps the torch-lit stone from clipping. */
export function tone(light: number, exposure = 1.25) {
  return 1 - Math.exp(-light * exposure);
}

/** Ambient occlusion from the distance to a crease (corner, overhang). */
export function crease(distance: number, strength = 0.38, width = 0.55) {
  return 1 - strength * Math.exp(-Math.max(0, distance) / width);
}
