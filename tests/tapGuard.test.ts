import { describe, expect, it } from 'vitest';
import { TapGuard } from '../src/game/hall/tapGuard';

describe('TapGuard', () => {
  it('rejects a release with no press on the same object', () => {
    const guard = new TapGuard();
    expect(guard.up('tablet', 1)).toBe(false);
  });

  it('accepts a press and release on the same object by the same pointer', () => {
    const guard = new TapGuard();
    guard.down('tablet', 1);
    expect(guard.up('tablet', 1)).toBe(true);
  });

  it('rejects a release on a different object than the press', () => {
    const guard = new TapGuard();
    guard.down('A', 1);
    expect(guard.up('B', 1)).toBe(false);
  });

  it('rejects a second release after a successful one', () => {
    const guard = new TapGuard();
    guard.down('tablet', 1);
    expect(guard.up('tablet', 1)).toBe(true);
    expect(guard.up('tablet', 1)).toBe(false);
  });

  it('rejects a release from a different pointer id', () => {
    const guard = new TapGuard();
    guard.down('tablet', 1);
    expect(guard.up('tablet', 2)).toBe(false);
  });

  it('clear() disarms pending presses', () => {
    const guard = new TapGuard();
    guard.down('tablet', 1);
    guard.clear();
    expect(guard.up('tablet', 1)).toBe(false);
  });
});
