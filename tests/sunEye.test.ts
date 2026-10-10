import { describe, expect, it } from 'vitest';
import {
  DWELL_MS,
  HIT_RADIUS,
  LIT_THRESHOLD,
  PITCH_LIMIT_DEG,
  EYE_SCREEN,
  SNAP_RADIUS,
  clampPitch,
  computeBeam,
  createSolvedState,
  createSunEyeState,
  deserializeSunEye,
  displaySpot,
  isSolved,
  rotate,
  serializeSunEye,
  solutionOrientation,
  tick,
  wrapDegrees,
} from '../src/game/puzzles/sunEye';
import type { BeamResult, SunEyeState } from '../src/game/puzzles/sunEye';

const FRAME_MS = 16;
const MAX_ITERATIONS = 2000;

/** A state the player is holding exactly on the solution, after real input. */
function heldOnSolution(): SunEyeState {
  const solution = solutionOrientation();
  return {
    ...createSunEyeState(),
    yaw: solution.yaw,
    pitch: solution.pitch,
    phase: 'manipulating',
    interacted: true,
  };
}

/**
 * Greedy player using only rotate() and tick(). Sweeps yaw in `turnDirection`
 * while the ray misses the facade, then hill-climbs the ray toward the eye
 * with fine steps, one axis at a time. Idles (tick only) when no step helps.
 */
function playGreedy(turnDirection: 1 | -1) {
  let state = createSunEyeState();
  let iterations = 0;
  while (!isSolved(state) && iterations < MAX_ITERATIONS) {
    iterations += 1;
    const beam = computeBeam(state.yaw, state.pitch);
    if (beam.hit !== 'facade') {
      state = rotate(state, 4 * turnDirection, 0);
    } else {
      const currentDistance = beam.distanceToEye;
      const moves: [number, number][] = [
        [1.2, 0],
        [-1.2, 0],
        [0, 0.6],
        [0, -0.6],
      ];
      let bestMove: [number, number] | undefined;
      let bestDistance = currentDistance;
      for (const move of moves) {
        const candidate = rotate(state, move[0], move[1]);
        const distance = computeBeam(
          candidate.yaw,
          candidate.pitch,
        ).distanceToEye;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestMove = move;
        }
      }
      if (bestMove) state = rotate(state, bestMove[0], bestMove[1]);
    }
    state = tick(state, FRAME_MS);
  }
  return { state, iterations };
}

function makeBeam(overrides: Partial<BeamResult>): BeamResult {
  return {
    lit: 1,
    catching: true,
    hit: 'facade',
    origin: { x: 0, y: 0 },
    spot: { x: EYE_SCREEN.x + 100, y: EYE_SCREEN.y },
    distanceToEye: 100,
    proximity: 0,
    ...overrides,
  };
}

describe('sunEye initial state', () => {
  it('starts at yaw 180, pitch 0, inspect phase, not interacted', () => {
    expect(createSunEyeState()).toEqual({
      yaw: 180,
      pitch: 0,
      phase: 'inspect',
      dwellMs: 0,
      interacted: false,
    });
  });

  it('does not hit the facade at the initial orientation', () => {
    const beam = computeBeam(180, 0);
    expect(beam.hit).toBe('back');
    expect(beam.hit).not.toBe('facade');
  });

  it('never solves on load, even after 5000 ms of ticks', () => {
    let state = createSunEyeState();
    for (let elapsed = 0; elapsed < 5000; elapsed += FRAME_MS) {
      state = tick(state, FRAME_MS);
    }
    expect(isSolved(state)).toBe(false);
    expect(state.phase).toBe('inspect');
    expect(state.dwellMs).toBe(0);
  });
});

describe('sunEye solution', () => {
  it('returns a pitch within the allowed range', () => {
    const solution = solutionOrientation();
    expect(Math.abs(solution.pitch)).toBeLessThanOrEqual(PITCH_LIMIT_DEG);
  });

  it('reflects the sun onto the eye at the solution orientation', () => {
    const solution = solutionOrientation();
    const beam = computeBeam(solution.yaw, solution.pitch);
    expect(beam.hit).toBe('facade');
    expect(beam.catching).toBe(true);
    expect(beam.distanceToEye).toBeLessThan(1);
  });
});

describe('sunEye solvability through real inputs', () => {
  it('reaches solved when turning left (negative yaw) first', () => {
    const { state, iterations } = playGreedy(-1);
    expect(
      state.phase,
      `greedy left-first did not solve in ${iterations} iterations`,
    ).toBe('solved');
    expect(iterations).toBeLessThan(MAX_ITERATIONS);
  });

  it('reaches solved when turning right (positive yaw) first', () => {
    const { state, iterations } = playGreedy(1);
    expect(
      state.phase,
      `greedy right-first did not solve in ${iterations} iterations`,
    ).toBe('solved');
    expect(iterations).toBeLessThan(MAX_ITERATIONS);
  });
});

describe('sunEye tolerance', () => {
  it('accepts orientations within ±1.5° yaw and ±1° pitch of the solution', () => {
    const solution = solutionOrientation();
    for (const dYaw of [-1.5, 0, 1.5]) {
      for (const dPitch of [-1, 0, 1]) {
        const beam = computeBeam(solution.yaw + dYaw, solution.pitch + dPitch);
        expect(
          beam.distanceToEye,
          `yaw offset ${dYaw}, pitch offset ${dPitch}`,
        ).toBeLessThanOrEqual(HIT_RADIUS);
      }
    }
  });

  it('rejects orientations 15° yaw away from the solution', () => {
    const solution = solutionOrientation();
    for (const dYaw of [-15, 15]) {
      const beam = computeBeam(solution.yaw + dYaw, solution.pitch);
      expect(beam.distanceToEye, `yaw offset ${dYaw}`).toBeGreaterThan(
        HIT_RADIUS,
      );
    }
  });
});

describe('sunEye dwell', () => {
  it('solves only after DWELL_MS of accumulated tick time', () => {
    const held = heldOnSolution();
    const almost = tick(held, DWELL_MS - 1);
    expect(isSolved(almost)).toBe(false);
    expect(almost.dwellMs).toBe(DWELL_MS - 1);

    const solved = tick(almost, 1);
    expect(isSolved(solved)).toBe(true);
  });

  it('accumulates dwell across several small ticks', () => {
    let state = heldOnSolution();
    for (let i = 0; i < 40; i += 1) {
      state = tick(state, FRAME_MS);
    }
    expect(isSolved(state)).toBe(false);
    state = tick(state, FRAME_MS);
    expect(isSolved(state)).toBe(true);
  });

  it('snaps the solved state to solutionOrientation()', () => {
    const solution = solutionOrientation();
    const solved = tick(heldOnSolution(), DWELL_MS);
    expect(solved.yaw).toBeCloseTo(solution.yaw, 10);
    expect(solved.pitch).toBeCloseTo(solution.pitch, 10);
  });

  it('never solves a state that is not interacted, even on the solution', () => {
    const solution = solutionOrientation();
    let state: SunEyeState = {
      ...createSunEyeState(),
      yaw: solution.yaw,
      pitch: solution.pitch,
    };
    for (let elapsed = 0; elapsed < 10000; elapsed += FRAME_MS) {
      state = tick(state, FRAME_MS);
    }
    expect(isSolved(state)).toBe(false);
    expect(state.dwellMs).toBe(0);
  });
});

describe('sunEye locked after solve', () => {
  it('rotate returns the same state object once solved', () => {
    const solved = createSolvedState();
    expect(rotate(solved, 10, 5)).toBe(solved);
  });

  it('tick keeps a solved state solved and unchanged', () => {
    const solved = createSolvedState();
    expect(tick(solved, DWELL_MS * 3)).toBe(solved);
    expect(isSolved(solved)).toBe(true);
  });
});

describe('sunEye input helpers', () => {
  it('wrapDegrees keeps values in (-180, 180]', () => {
    for (let angle = -1000; angle <= 1000; angle += 7.3) {
      const wrapped = wrapDegrees(angle);
      expect(wrapped).toBeGreaterThan(-180);
      expect(wrapped).toBeLessThanOrEqual(180);
      const turns = (angle - wrapped) / 360;
      expect(Math.abs(turns - Math.round(turns))).toBeLessThan(1e-9);
    }
  });

  it('wrapDegrees maps the seam to 180 and leaves in-range values alone', () => {
    expect(wrapDegrees(180)).toBe(180);
    expect(wrapDegrees(-180)).toBe(180);
    expect(wrapDegrees(540)).toBe(180);
    expect(wrapDegrees(45)).toBe(45);
    expect(wrapDegrees(190)).toBeCloseTo(-170, 10);
  });

  it('clampPitch clamps to ±PITCH_LIMIT_DEG', () => {
    expect(clampPitch(40)).toBe(PITCH_LIMIT_DEG);
    expect(clampPitch(-40)).toBe(-PITCH_LIMIT_DEG);
    expect(clampPitch(10)).toBe(10);
  });

  it('rotate sets interacted and manipulating phase, and wraps yaw', () => {
    const next = rotate(createSunEyeState(), 200, -30);
    expect(next.interacted).toBe(true);
    expect(next.phase).toBe('manipulating');
    expect(next.yaw).toBeCloseTo(20, 10);
    expect(next.pitch).toBe(-PITCH_LIMIT_DEG);
  });
});

describe('sunEye displaySpot', () => {
  it('returns undefined when there is no spot', () => {
    expect(
      displaySpot(makeBeam({ spot: undefined, hit: 'none' })),
    ).toBeUndefined();
  });

  it('pulls a facade spot closer to the eye within SNAP_RADIUS', () => {
    const beam = makeBeam({ distanceToEye: 10 });
    const shown = displaySpot(beam);
    expect(shown).toBeDefined();
    const before = Math.hypot(
      beam.spot!.x - EYE_SCREEN.x,
      beam.spot!.y - EYE_SCREEN.y,
    );
    const after = Math.hypot(shown!.x - EYE_SCREEN.x, shown!.y - EYE_SCREEN.y);
    expect(after).toBeLessThan(before);
  });

  it('returns the raw spot when the facade hit is outside SNAP_RADIUS', () => {
    const beam = makeBeam({ distanceToEye: SNAP_RADIUS + 5 });
    expect(displaySpot(beam)).toEqual(beam.spot);
  });

  it('returns the raw spot for non-facade hits even when close', () => {
    const beam = makeBeam({ hit: 'sky', distanceToEye: Infinity });
    expect(displaySpot(beam)).toEqual(beam.spot);
  });
});

describe('sunEye serialization', () => {
  it('round-trips yaw and pitch for an unsolved state', () => {
    const original: SunEyeState = {
      ...createSunEyeState(),
      yaw: 33,
      pitch: -7,
      phase: 'manipulating',
      interacted: true,
    };
    const restored = deserializeSunEye(serializeSunEye(original));
    expect(restored.yaw).toBeCloseTo(33, 10);
    expect(restored.pitch).toBeCloseTo(-7, 10);
    expect(isSolved(restored)).toBe(false);
  });

  it('deserializes a solved state to a solved state', () => {
    const restored = deserializeSunEye(serializeSunEye(createSolvedState()));
    expect(isSolved(restored)).toBe(true);
    const solution = solutionOrientation();
    expect(restored.yaw).toBeCloseTo(solution.yaw, 10);
    expect(restored.pitch).toBeCloseTo(solution.pitch, 10);
  });

  it('clamps an out-of-range pitch on load', () => {
    const restored = deserializeSunEye('{"yaw":10,"pitch":90,"solved":false}');
    expect(restored.pitch).toBe(PITCH_LIMIT_DEG);
  });

  it('returns a fresh unsolved state for garbage input', () => {
    const fresh = createSunEyeState();
    for (const garbage of [
      null,
      undefined,
      '',
      'not json',
      'null',
      '42',
      '{"yaw":"x"}',
    ]) {
      expect(deserializeSunEye(garbage), `input ${String(garbage)}`).toEqual(
        fresh,
      );
    }
  });
});

describe('sunEye physical sanity', () => {
  it('a surface facing away from the sun is not catching and hits nothing', () => {
    // Normal azimuth opposite the sun's azimuth (yaw -80 vs sun at 100).
    const beam = computeBeam(-80, 0);
    expect(beam.lit).toBeLessThan(LIT_THRESHOLD);
    expect(beam.catching).toBe(false);
    expect(beam.hit).toBe('none');
  });

  it('catching always matches the lit threshold and non-catching never hits', () => {
    for (let yaw = -180; yaw <= 180; yaw += 15) {
      for (let pitch = -PITCH_LIMIT_DEG; pitch <= PITCH_LIMIT_DEG; pitch += 5) {
        const beam = computeBeam(yaw, pitch);
        expect(beam.catching, `yaw ${yaw}, pitch ${pitch}`).toBe(
          beam.lit >= LIT_THRESHOLD,
        );
        if (!beam.catching) {
          expect(beam.hit, `yaw ${yaw}, pitch ${pitch}`).toBe('none');
        }
      }
    }
  });
});
