import { progress } from '../prologue/progress';
import {
  createStarAlignment,
  discoverStarClue,
  restoreStarAlignment,
} from '../puzzles/lostConstellation';
import type { StarClueId, StarAlignment } from '../puzzles/lostConstellation';

export const STAR_ROOM_ID = 'chamber-of-stars';
export const STAR_SECRET_ID = 'astronomer-cartouche';

export function starAlignment(): StarAlignment {
  const saved = progress.current().stars;
  const restored = restoreStarAlignment(saved);
  if (JSON.stringify(saved.discoveredClues) !== JSON.stringify(restored.discoveredClues) ||
    saved.constellation !== restored.constellation || saved.rotation !== restored.rotation ||
    saved.solved !== restored.solved) saveStarAlignment(restored);
  return restored;
}

export function saveStarAlignment(state: StarAlignment) {
  progress.commit((save) => {
    save.stars.constellation = state.constellation;
    save.stars.rotation = state.rotation;
    save.stars.solved = state.solved;
    save.stars.discoveredClues = [...state.discoveredClues];
  });
}

export function revealStarClue(id: StarClueId) {
  const next = discoverStarClue(starAlignment(), id);
  saveStarAlignment(next);
  return next;
}

export function initializeStarAlignment() {
  const saved = progress.current().stars;
  if (saved.constellation !== null || saved.discoveredClues.length) return starAlignment();
  const initial = createStarAlignment();
  saveStarAlignment(initial);
  return initial;
}
