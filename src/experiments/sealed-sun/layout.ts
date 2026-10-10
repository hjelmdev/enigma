/**
 * Chamber geometry. The room is modelled as a simple box seen in one-point
 * perspective; every surface is rendered by inverse-projecting each art pixel
 * into world space, so blocks, slabs and reliefs foreshorten correctly and the
 * light falls where the torches actually are.
 *
 * World units: x right, y down (0 = eye height), z away from the viewer.
 * Screen units: art pixels in the ROOM_W × ROOM_H background.
 *
 * Gameplay (hotspots) and art both read these numbers; neither owns them.
 */

export const ROOM_W = 560;
export const ROOM_H = 300;

export const VIEW = {
  vx: 280,
  vy: 156,
  focal: 290,
} as const;

export const ROOM = {
  halfWidth: 6,
  floorY: 3, // eye is 3 units above the floor
  ceilingY: -6.4,
  backZ: 14,
} as const;

export const DOOR = {
  halfWidth: 1.7,
  topY: -3.05,
  /** Plane of the granite slab, recessed into the wall thickness. */
  slabZ: 14.9,
  /** Back face of the wall; the corridor starts here. */
  wallBackZ: 16,
  frameHalfWidth: 2.55,
  lintelTopY: -4.25,
  corniceTopY: -5.1,
  corridorEndZ: 40,
} as const;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function project(x: number, y: number, z: number) {
  return {
    x: VIEW.vx + (VIEW.focal * x) / z,
    y: VIEW.vy + (VIEW.focal * y) / z,
  };
}

/** Screen-space scale (art px per world unit) at depth z. */
export function scaleAt(z: number) {
  return VIEW.focal / z;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function rectFrom(x0: number, y0: number, x1: number, y1: number): Rect {
  const x = Math.round(x0);
  const y = Math.round(y0);
  return { x, y, w: Math.round(x1) - x, h: Math.round(y1) - y };
}

/** Back wall face in screen space. */
export const BACK_WALL = (() => {
  const a = project(-ROOM.halfWidth, ROOM.ceilingY, ROOM.backZ);
  const b = project(ROOM.halfWidth, ROOM.floorY, ROOM.backZ);
  return rectFrom(a.x, a.y, b.x, b.y);
})();

/**
 * The hole in the room layer: the doorway as seen at the slab plane. The slab
 * sits behind the room layer and fills exactly this rectangle, so the floor
 * and threshold in the room layer occlude it as it sinks.
 */
export const DOOR_HOLE = (() => {
  const a = project(-DOOR.halfWidth, DOOR.topY, DOOR.slabZ);
  const b = project(DOOR.halfWidth, ROOM.floorY, DOOR.slabZ);
  return rectFrom(a.x, a.y, b.x, b.y);
})();

/** The doorway at the wall face (the reveal sides run from here to the hole). */
export const DOOR_FACE = (() => {
  const a = project(-DOOR.halfWidth, DOOR.topY, ROOM.backZ);
  const b = project(DOOR.halfWidth, ROOM.floorY, ROOM.backZ);
  return rectFrom(a.x, a.y, b.x, b.y);
})();

/** The granite slab sprite: the hole plus an overlap hidden behind the frame. */
export const DOOR_SLAB = {
  x: DOOR_HOLE.x - 3,
  y: DOOR_HOLE.y - 4,
  w: DOOR_HOLE.w + 6,
  h: DOOR_HOLE.h + 6,
};

/** World positions of the two wall torches (flame base). */
export const TORCHES: Vec3[] = [
  { x: -3.25, y: -1.15, z: ROOM.backZ - 0.35 },
  { x: 3.25, y: -1.15, z: ROOM.backZ - 0.35 },
];

/** The seal stand: a freestanding stone stand on the floor, facing the viewer. */
export const STAND = {
  x: 3.85,
  z: 9.6,
  baseHalfWidth: 0.95,
  baseHeight: 0.42,
  bodyHalfWidth: 0.62,
  bodyTopY: 0.25, // y of the top of the body (floor is 3)
  discCenterY: -0.45,
  discRadius: 0.74,
} as const;

/** The stele on the left wall, in wall coordinates (z along, y down). */
export const STELE = {
  z0: 8.2,
  z1: 11.0,
  topY: -2.9,
  bottomY: 2.55,
  /** Flat art size; the wall samples it in perspective. */
  artW: 84,
  artH: 164,
} as const;

/** Inlaid floor channel from the stand to the door threshold (floor x, z). */
export const CHANNEL: { x: number; z: number }[] = [
  { x: STAND.x - 0.35, z: STAND.z + 0.25 },
  { x: 2.3, z: 11.9 },
  { x: 0.9, z: 13.35 },
  { x: 0, z: ROOM.backZ - 0.05 },
];

/** Screen bounds of the stand sprite, derived from its world box. */
export const STAND_RECT = (() => {
  const s = scaleAt(STAND.z);
  const cx = VIEW.vx + STAND.x * s;
  const top = VIEW.vy + (STAND.discCenterY - STAND.discRadius - 0.35) * s;
  const bottom = VIEW.vy + ROOM.floorY * s;
  const half = STAND.baseHalfWidth * s + 3;
  return rectFrom(cx - half, top, cx + half, bottom + 2);
})();

/** Screen polygon of the stele on the left wall. */
export function stelePolygon() {
  const z0 = STELE.z0;
  const z1 = STELE.z1;
  const x = -ROOM.halfWidth;
  return [
    project(x, STELE.bottomY, z0),
    project(x, STELE.topY, z0),
    project(x, STELE.topY, z1),
    project(x, STELE.bottomY, z1),
  ];
}

export type HotspotId = 'stele' | 'seal' | 'door';

export interface Hotspot {
  id: HotspotId;
  label: string;
  /** Screen-space hit polygon in room art pixels. */
  polygon: { x: number; y: number }[];
  /** Where the camera centres when focusing. */
  focus: { x: number; y: number };
  /** Marker position for the inspect glint. */
  marker: { x: number; y: number };
}

function rectPolygon(r: Rect, pad = 0) {
  return [
    { x: r.x - pad, y: r.y - pad },
    { x: r.x + r.w + pad, y: r.y - pad },
    { x: r.x + r.w + pad, y: r.y + r.h + pad },
    { x: r.x - pad, y: r.y + r.h + pad },
  ];
}

export const HOTSPOTS: Hotspot[] = (() => {
  const stele = stelePolygon();
  const steleCenter = {
    x: (stele[0].x + stele[2].x) / 2,
    y: (stele[0].y + stele[1].y) / 2,
  };
  const stand = STAND_RECT;
  const frameA = project(-DOOR.frameHalfWidth, DOOR.corniceTopY, ROOM.backZ);
  const frameB = project(DOOR.frameHalfWidth, ROOM.floorY, ROOM.backZ);
  const discY = VIEW.vy + STAND.discCenterY * scaleAt(STAND.z);
  return [
    {
      id: 'stele',
      label: 'Stelen',
      polygon: stele,
      focus: steleCenter,
      marker: { x: steleCenter.x, y: stele[1].y + 10 },
    },
    {
      id: 'seal',
      label: 'Solsigillet',
      polygon: rectPolygon(stand, 4),
      focus: { x: stand.x + stand.w / 2, y: discY },
      marker: { x: stand.x + stand.w / 2, y: stand.y - 6 },
    },
    {
      id: 'door',
      label: 'Granitporten',
      polygon: rectPolygon(
        rectFrom(frameA.x + 12, frameA.y + 30, frameB.x - 12, frameB.y),
      ),
      focus: { x: VIEW.vx, y: (frameA.y + frameB.y) / 2 },
      marker: { x: VIEW.vx, y: DOOR_HOLE.y + 10 },
    },
  ];
})();

export function pointInPolygon(
  px: number,
  py: number,
  poly: { x: number; y: number }[],
) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (
      a.y > py !== b.y > py &&
      px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}
