import { describe, expect, it } from 'vitest';
import {
  initialDoorState,
  transitionDoorState,
} from '../src/game/presentation/doorState';

describe('door presentation state', () => {
  it('starts locked doors closed and unlocked doors visibly open', () => {
    expect(initialDoorState(false)).toBe('closed');
    expect(initialDoorState(true)).toBe('open');
  });

  it('only opens through the opening state and stays open', () => {
    const opening = transitionDoorState('closed', 'begin-opening');
    expect(opening).toBe('opening');
    const open = transitionDoorState(opening, 'finish-opening');
    expect(open).toBe('open');
    expect(transitionDoorState(open, 'begin-opening')).toBe('open');
    expect(transitionDoorState('closed', 'finish-opening')).toBe('closed');
  });
});
