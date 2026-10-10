/** Pure rules for the Chamber of Stars' lost-constellation instrument. */
export const STAR_CLUE_IDS = ['star-chart', 'horizon-relief'] as const;
export type StarClueId = (typeof STAR_CLUE_IDS)[number];

export const CONSTELLATIONS = {
  reed: {
    label: 'Vassfågeln',
    stars: [[-1, 0], [0, 0], [1, 0], [1, -1], [-1, 1]],
  },
  crown: {
    label: 'Kronan',
    stars: [[-1, 0], [0, 0], [1, 0], [-1, -1], [1, -1]],
  },
  boat: {
    label: 'Nattbåten',
    stars: [[-1, 0], [0, 0], [1, 0], [-1, 1], [1, 1]],
  },
  hook: {
    label: 'Fiskekroken',
    stars: [[-1, 1], [0, 1], [1, 1], [1, 0], [1, -1]],
  },
} as const;

export type ConstellationId = keyof typeof CONSTELLATIONS;
export type StarAlignment = {
  constellation: ConstellationId | null;
  rotation: number;
  solved: boolean;
  discoveredClues: StarClueId[];
};

export const CORRECT_CONSTELLATION: ConstellationId = 'reed';
export const CORRECT_ROTATION = 0; // North: the raised star must point up.

export function createStarAlignment(): StarAlignment {
  return { constellation: null, rotation: 2, solved: false, discoveredClues: [] };
}

export function restoreStarAlignment(value: unknown): StarAlignment {
  const fallback = createStarAlignment();
  if (!value || typeof value !== 'object') return fallback;
  const raw = value as Partial<StarAlignment>;
  const constellation = typeof raw.constellation === 'string' && Object.hasOwn(CONSTELLATIONS, raw.constellation)
    ? (raw.constellation as ConstellationId)
    : null;
  const rotation = Number.isInteger(raw.rotation)
    ? ((raw.rotation! % 4) + 4) % 4
    : fallback.rotation;
  const discoveredClues = STAR_CLUE_IDS.filter((id) =>
    Array.isArray(raw.discoveredClues) && raw.discoveredClues.includes(id),
  );
  const solved = raw.solved === true && hasAllStarClues(discoveredClues) &&
    constellation === CORRECT_CONSTELLATION && rotation === CORRECT_ROTATION;
  return { constellation, rotation, solved, discoveredClues: [...discoveredClues] };
}

export function discoverStarClue(
  state: StarAlignment,
  clue: StarClueId,
): StarAlignment {
  if (state.solved || state.discoveredClues.includes(clue)) return state;
  return { ...state, discoveredClues: [...state.discoveredClues, clue] };
}

export function hasAllStarClues(state: Pick<StarAlignment, 'discoveredClues'> | StarClueId[]) {
  const clues = Array.isArray(state) ? state : state.discoveredClues;
  return STAR_CLUE_IDS.every((id) => clues.includes(id));
}

export function rotateStarWheel(state: StarAlignment, direction: -1 | 1) {
  if (state.solved) return state;
  return { ...state, rotation: (state.rotation + direction + 4) % 4 };
}

export function chooseConstellation(
  state: StarAlignment,
  constellation: ConstellationId,
) {
  if (state.solved) return state;
  return { ...state, constellation };
}

export function validateStarAlignment(state: StarAlignment) {
  return (
    !state.solved &&
    hasAllStarClues(state) &&
    state.constellation === CORRECT_CONSTELLATION &&
    state.rotation === CORRECT_ROTATION
  );
}

export function solveStarAlignment(state: StarAlignment): StarAlignment {
  return validateStarAlignment(state) ? { ...state, solved: true } : state;
}

export function resetStarAlignment(state: StarAlignment): StarAlignment {
  return state.solved
    ? state
    : { ...state, constellation: null, rotation: 2 };
}
