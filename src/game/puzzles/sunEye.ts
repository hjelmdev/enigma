/**
 * Ögats ljus — the prologue's sunlight puzzle.
 *
 * The miniature sits in a bronze cradle on a pedestal in front of the
 * pyramid. Its eye face carries a polished inlay that acts as a small mirror.
 * The player turns (yaw) and tilts (pitch) the miniature; when the inlay
 * faces the sun it reflects a narrow ray, which is traced into the close-up
 * view and must land on the carved eye above the hidden entrance.
 *
 * All geometry is real vector math so the puzzle is solvable by reasoning
 * ("turn the eye toward the sun, then steer the ray") rather than by a
 * hard-coded answer. Screen coordinates refer to the 640x360 close-up art.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Slope of the miniature's faces: a face normal sits 38° above horizontal. */
export const FACE_ELEVATION_DEG = 38;
export const PITCH_LIMIT_DEG = 25;
export const SUN_AZIMUTH_DEG = 100;
export const SUN_ELEVATION_DEG = 35;

/** Close-up camera: viewer at the origin looking down +z. */
export const VIEW = { width: 640, height: 360, cx: 320, cy: 180, focal: 264 };
/**
 * The close-up is framed from the raised pedestal terrace, so the façade base
 * sits low in frame; ground hits project below y = 260 in the close-up art.
 */
export const VIEWER_HEIGHT = 18;
export const FACADE_Z = 60;
/** Where the inlay sits (cradle on the pedestal), in metres. */
export const MINIATURE_WORLD: Vec3 = { x: 0, y: -1, z: 3 };
/** Carved eye relief: projects to (320, 118) in the close-up art. */
export const EYE_SCREEN: Point = { x: 320, y: 118 };
export const EYE_WORLD: Vec3 = {
  x: 0,
  y: ((VIEW.cy - EYE_SCREEN.y) * FACADE_Z) / VIEW.focal,
  z: FACADE_Z,
};
/** Front face of the pyramid in the close-up art (screen space triangle). */
export const FACADE_TRIANGLE: [Point, Point, Point] = [
  { x: -60, y: 260 },
  { x: 700, y: 260 },
  { x: 320, y: -260 },
];

export const HIT_RADIUS = 20;
export const SNAP_RADIUS = 30;
export const NEAR_RADIUS = 70;
export const DWELL_MS = 650;
export const LIT_THRESHOLD = 0.2;

export const INITIAL_YAW = 180;
export const INITIAL_PITCH = 0;

export type SunEyePhase = 'inspect' | 'manipulating' | 'solved';

export interface SunEyeState {
  yaw: number;
  pitch: number;
  phase: SunEyePhase;
  dwellMs: number;
  interacted: boolean;
}

export type BeamHit = 'none' | 'back' | 'facade' | 'ground' | 'sky';

export interface BeamResult {
  /** 0..1, how squarely the inlay faces the sun. */
  lit: number;
  catching: boolean;
  hit: BeamHit;
  origin: Point;
  /** Where the ray lands (or a far point along it for 'sky'). */
  spot?: Point;
  /** Screen distance to the eye; Infinity unless the ray hits the façade. */
  distanceToEye: number;
  /** 0..1, grows as the spot approaches the eye (within NEAR_RADIUS). */
  proximity: number;
}

const DEG = Math.PI / 180;

export const SUN_DIRECTION: Vec3 = fromAngles(
  SUN_AZIMUTH_DEG,
  SUN_ELEVATION_DEG,
);

export function createSunEyeState(): SunEyeState {
  return {
    yaw: INITIAL_YAW,
    pitch: INITIAL_PITCH,
    phase: 'inspect',
    dwellMs: 0,
    interacted: false,
  };
}

export function wrapDegrees(angle: number) {
  const wrapped = ((((angle + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

export function clampPitch(pitch: number) {
  return Math.max(-PITCH_LIMIT_DEG, Math.min(PITCH_LIMIT_DEG, pitch));
}

/** Unit vector for an azimuth (0 = +z toward the pyramid, 90 = +x right). */
export function fromAngles(azimuthDeg: number, elevationDeg: number): Vec3 {
  const a = azimuthDeg * DEG;
  const e = elevationDeg * DEG;
  return {
    x: Math.cos(e) * Math.sin(a),
    y: Math.sin(e),
    z: Math.cos(e) * Math.cos(a),
  };
}

export function inlayNormal(yaw: number, pitch: number): Vec3 {
  return fromAngles(yaw, FACE_ELEVATION_DEG + clampPitch(pitch));
}

export function project(point: Vec3): Point {
  return {
    x: VIEW.cx + (VIEW.focal * point.x) / point.z,
    y: VIEW.cy - (VIEW.focal * point.y) / point.z,
  };
}

function dot(a: Vec3, b: Vec3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function insideTriangle(p: Point, [a, b, c]: [Point, Point, Point]) {
  const side = (p1: Point, p2: Point, p3: Point) =>
    (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const d1 = side(p, a, b);
  const d2 = side(p, b, c);
  const d3 = side(p, c, a);
  const negative = d1 < 0 || d2 < 0 || d3 < 0;
  const positive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(negative && positive);
}

export function computeBeam(yaw: number, pitch: number): BeamResult {
  const normal = inlayNormal(yaw, pitch);
  const lit = Math.max(0, dot(normal, SUN_DIRECTION));
  const origin = project(MINIATURE_WORLD);
  const base: BeamResult = {
    lit,
    catching: lit >= LIT_THRESHOLD,
    hit: 'none',
    origin,
    distanceToEye: Infinity,
    proximity: 0,
  };
  if (!base.catching) return base;

  // Mirror reflection of the incoming sunlight about the inlay normal.
  const incoming = {
    x: -SUN_DIRECTION.x,
    y: -SUN_DIRECTION.y,
    z: -SUN_DIRECTION.z,
  };
  const k = 2 * dot(incoming, normal);
  const ray = normalize({
    x: incoming.x - k * normal.x,
    y: incoming.y - k * normal.y,
    z: incoming.z - k * normal.z,
  });
  if (ray.z <= 0.05) return { ...base, hit: 'back' };

  const groundY = -VIEWER_HEIGHT;
  const tFacade = (FACADE_Z - MINIATURE_WORLD.z) / ray.z;
  const tGround =
    ray.y < 0
      ? (groundY - MINIATURE_WORLD.y) / ray.y
      : Number.POSITIVE_INFINITY;
  if (tGround < tFacade) {
    const spot = project({
      x: MINIATURE_WORLD.x + ray.x * tGround,
      y: groundY,
      z: MINIATURE_WORLD.z + ray.z * tGround,
    });
    return { ...base, hit: 'ground', spot };
  }
  const spot = project({
    x: MINIATURE_WORLD.x + ray.x * tFacade,
    y: MINIATURE_WORLD.y + ray.y * tFacade,
    z: FACADE_Z,
  });
  if (!insideTriangle(spot, FACADE_TRIANGLE))
    return { ...base, hit: 'sky', spot };
  const distanceToEye = Math.hypot(
    spot.x - EYE_SCREEN.x,
    spot.y - EYE_SCREEN.y,
  );
  const proximity = Math.max(0, 1 - distanceToEye / NEAR_RADIUS);
  return { ...base, hit: 'facade', spot, distanceToEye, proximity };
}

/** Exact orientation that reflects the sun onto the eye (used for snapping). */
export function solutionOrientation() {
  const toEye = normalize({
    x: EYE_WORLD.x - MINIATURE_WORLD.x,
    y: EYE_WORLD.y - MINIATURE_WORLD.y,
    z: EYE_WORLD.z - MINIATURE_WORLD.z,
  });
  const bisector = normalize({
    x: SUN_DIRECTION.x + toEye.x,
    y: SUN_DIRECTION.y + toEye.y,
    z: SUN_DIRECTION.z + toEye.z,
  });
  return {
    yaw: Math.atan2(bisector.x, bisector.z) / DEG,
    pitch: Math.asin(bisector.y) / DEG - FACE_ELEVATION_DEG,
  };
}

/** Spot shown to the player: eased toward the eye when it is close enough. */
export function displaySpot(beam: BeamResult): Point | undefined {
  if (!beam.spot) return undefined;
  if (beam.hit !== 'facade' || beam.distanceToEye > SNAP_RADIUS)
    return beam.spot;
  const pull = 0.55 * (1 - beam.distanceToEye / SNAP_RADIUS);
  return {
    x: beam.spot.x + (EYE_SCREEN.x - beam.spot.x) * pull,
    y: beam.spot.y + (EYE_SCREEN.y - beam.spot.y) * pull,
  };
}

export function rotate(
  state: SunEyeState,
  deltaYaw: number,
  deltaPitch: number,
): SunEyeState {
  if (state.phase === 'solved') return state;
  if (deltaYaw === 0 && deltaPitch === 0) return state;
  return {
    ...state,
    yaw: wrapDegrees(state.yaw + deltaYaw),
    pitch: clampPitch(state.pitch + deltaPitch),
    phase: 'manipulating',
    interacted: true,
  };
}

/**
 * Advance the dwell timer. The ray must rest on the eye for DWELL_MS after
 * a real player input; this prevents accidental completion on load.
 */
export function tick(state: SunEyeState, elapsedMs: number): SunEyeState {
  if (state.phase === 'solved') return state;
  const beam = computeBeam(state.yaw, state.pitch);
  const onEye =
    state.interacted &&
    beam.hit === 'facade' &&
    beam.distanceToEye <= HIT_RADIUS;
  const dwellMs = onEye
    ? state.dwellMs + elapsedMs
    : Math.max(0, state.dwellMs - elapsedMs * 2);
  if (dwellMs >= DWELL_MS) {
    const solution = solutionOrientation();
    return {
      ...state,
      yaw: solution.yaw,
      pitch: solution.pitch,
      dwellMs: DWELL_MS,
      phase: 'solved',
    };
  }
  return { ...state, dwellMs };
}

export function isSolved(state: SunEyeState) {
  return state.phase === 'solved';
}

export function createSolvedState(): SunEyeState {
  const solution = solutionOrientation();
  return {
    yaw: solution.yaw,
    pitch: solution.pitch,
    phase: 'solved',
    dwellMs: DWELL_MS,
    interacted: true,
  };
}

/** Input sensitivity: coarse turning, finer aiming once the ray is on stone. */
export function inputSensitivity(beam: BeamResult) {
  if (beam.hit !== 'facade') return 1;
  return beam.proximity > 0 ? 0.35 : 0.5;
}

export function serializeSunEye(state: SunEyeState) {
  return JSON.stringify({
    yaw: state.yaw,
    pitch: state.pitch,
    solved: state.phase === 'solved',
  });
}

export function deserializeSunEye(
  text: string | null | undefined,
): SunEyeState {
  try {
    const raw = JSON.parse(text ?? '') as Partial<{
      yaw: number;
      pitch: number;
      solved: boolean;
    }>;
    if (raw.solved === true) return createSolvedState();
    const state = createSunEyeState();
    if (typeof raw.yaw === 'number' && Number.isFinite(raw.yaw))
      state.yaw = wrapDegrees(raw.yaw);
    if (typeof raw.pitch === 'number' && Number.isFinite(raw.pitch))
      state.pitch = clampPitch(raw.pitch);
    return state;
  } catch {
    return createSunEyeState();
  }
}
