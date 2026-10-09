import type { DoorVisualState } from '../world/types';

export type DoorStateEvent = 'begin-opening' | 'finish-opening';

export function transitionDoorState(
  state: DoorVisualState,
  event: DoorStateEvent,
): DoorVisualState {
  if (state === 'closed' && event === 'begin-opening') return 'opening';
  if (state === 'opening' && event === 'finish-opening') return 'open';
  return state;
}

export function initialDoorState(isUnlocked: boolean): DoorVisualState {
  return isUnlocked ? 'open' : 'closed';
}
