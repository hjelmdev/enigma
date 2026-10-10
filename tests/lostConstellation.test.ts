import { describe, expect, it } from 'vitest';
import {
  chooseConstellation,
  createStarAlignment,
  discoverStarClue,
  hasAllStarClues,
  resetStarAlignment,
  restoreStarAlignment,
  rotateStarWheel,
  solveStarAlignment,
  validateStarAlignment,
} from '../src/game/puzzles/lostConstellation';
import type { StarAlignment } from '../src/game/puzzles/lostConstellation';
import {
  createNewSave,
  deserializeSave,
  sanitizeSave,
  serializeSave,
} from '../src/game/state/prologueSave';
import { createChapter1Graph, EXIT, visibleMap } from '../src/game/world/pyramidMap';

describe('Lost Constellation puzzle', () => {
  it('requires both explored clues before the instrument can validate', () => {
    let state = createStarAlignment();
    state = chooseConstellation(state, 'reed');
    state = rotateStarWheel(state, -1);
    expect(state.rotation).toBe(1);
    expect(validateStarAlignment(state)).toBe(false);
    state = discoverStarClue(state, 'star-chart');
    expect(hasAllStarClues(state)).toBe(false);
    expect(validateStarAlignment(state)).toBe(false);
    state = discoverStarClue(state, 'horizon-relief');
    expect(hasAllStarClues(state)).toBe(true);
    state = rotateStarWheel(state, -1);
    expect(validateStarAlignment(state)).toBe(true);
  });

  it.each(['crown', 'boat', 'hook'] as const)(
    'rejects decoy constellation %s even at north',
    (constellation) => {
      const state: StarAlignment = {
        ...createStarAlignment(),
        constellation,
        rotation: 0,
        discoveredClues: ['star-chart', 'horizon-relief'],
      };
      expect(validateStarAlignment(state)).toBe(false);
      expect(solveStarAlignment(state).solved).toBe(false);
    },
  );

  it.each([1, 2, 3])('rejects reed at incorrect rotation %i', (rotation) => {
    const state: StarAlignment = {
      ...createStarAlignment(),
      constellation: 'reed' as const,
      rotation,
      discoveredClues: ['star-chart', 'horizon-relief'],
    };
    expect(validateStarAlignment(state)).toBe(false);
    expect(solveStarAlignment(state).solved).toBe(false);
  });

  it('solves uniquely with reed aligned north and locks solved state', () => {
    let state = createStarAlignment();
    state = discoverStarClue(state, 'star-chart');
    state = discoverStarClue(state, 'horizon-relief');
    state = chooseConstellation(state, 'reed');
    state = rotateStarWheel(state, -1);
    expect(state.rotation).toBe(1);
    state = rotateStarWheel(state, -1);
    expect(state.rotation).toBe(0);
    expect(validateStarAlignment(state)).toBe(true);
    const solved = solveStarAlignment(state);
    expect(solved.solved).toBe(true);
    expect(resetStarAlignment(solved)).toBe(solved);
    expect(rotateStarWheel(solved, 1)).toBe(solved);
    expect(chooseConstellation(solved, 'boat')).toBe(solved);
    expect(discoverStarClue(solved, 'star-chart')).toBe(solved);
  });

  it('wraps wheel rotations in both directions and resets unsolved selection', () => {
    const start = createStarAlignment();
    expect(start.rotation).toBe(2);
    expect(rotateStarWheel(start, 1).rotation).toBe(3);
    expect(rotateStarWheel(rotateStarWheel(start, 1), 1).rotation).toBe(0);
    expect(rotateStarWheel(start, -1).rotation).toBe(1);
    expect(rotateStarWheel(rotateStarWheel(start, -1), -1).rotation).toBe(0);
    const selected = chooseConstellation(start, 'hook');
    const reset = resetStarAlignment(selected);
    expect(reset.constellation).toBeNull();
    expect(reset.rotation).toBe(2);
  });

  it('restores and sanitizes persisted stars, including corrupted state', () => {
    const raw = {
      constellation: 'reed', rotation: -4, solved: true,
      discoveredClues: ['star-chart', 'horizon-relief', 'unknown', 'star-chart'],
    };
    expect(restoreStarAlignment(raw)).toMatchObject({
      constellation: 'reed', rotation: 0, solved: true,
      discoveredClues: ['star-chart', 'horizon-relief'],
    });
    expect(restoreStarAlignment({ ...raw, discoveredClues: ['star-chart'] }).solved).toBe(false);
    expect(restoreStarAlignment({ ...raw, constellation: 'made-up' }).constellation).toBeNull();
    expect(restoreStarAlignment({ ...raw, rotation: 2.5 }).rotation).toBe(2);

    const save = createNewSave(123);
    const corrupted = sanitizeSave({
      ...save,
      stars: {
        ...save.stars,
        constellation: 'reed', rotation: -1, solved: true,
        discoveredClues: ['star-chart', 'bogus', 'star-chart'],
        camX: Infinity, camY: 'bad',
      },
    })!;
    expect(corrupted.stars).toMatchObject({
      constellation: 'reed', rotation: 3, solved: false,
      discoveredClues: ['star-chart'], camX: null, camY: null,
    });
    const roundTrip = deserializeSave(serializeSave({
      ...save,
      stars: {
        ...save.stars, constellation: 'reed', rotation: 0, solved: true,
        discoveredClues: ['star-chart', 'horizon-relief'],
      },
    }));
    expect(roundTrip?.stars.solved).toBe(true);
  });

  it('migrates v3 saves into v4 while sanitizing their star state', () => {
    const v3 = { ...createNewSave(4), version: 3, stage: 'stars' as const,
      stars: { ...createNewSave(4).stars, constellation: 'reed' as const,
        rotation: 4, solved: true, discoveredClues: ['star-chart', 'horizon-relief'] } };
    const migrated = sanitizeSave(v3);
    expect(migrated?.version).toBe(4);
    expect(migrated?.stars).toMatchObject({
      constellation: 'reed', rotation: 0, solved: true,
      discoveredClues: ['star-chart', 'horizon-relief'],
    });
  });

  it('keeps the chamber hidden until entered, then exposes the traversed connection', () => {
    const graph = createChapter1Graph();
    const initial = {
      currentRoom: 'entrance-hall', visitedRooms: ['exterior', 'entrance-passage', 'entrance-hall'],
      seenExits: [EXIT.balanceDoor], openedExits: [EXIT.balanceDoor], traversedExits: [],
    };
    const before = visibleMap(graph, initial);
    expect(before.rooms.some((room) => room.id === 'chamber-of-stars')).toBe(false);
    expect(before.links.find((link) => link.exitId === EXIT.balanceDoor)?.to).toBeNull();
    const entered = visibleMap(graph, {
      ...initial, currentRoom: 'chamber-of-stars',
      visitedRooms: [...initial.visitedRooms, 'chamber-of-stars'],
      traversedExits: [EXIT.balanceDoor],
    });
    expect(entered.rooms.find((room) => room.id === 'chamber-of-stars')).toMatchObject({
      name: 'Stjärnornas kammare', current: true,
    });
    expect(entered.links.find((link) => link.exitId === EXIT.balanceDoor)).toMatchObject({
      from: 'entrance-hall', to: 'chamber-of-stars', state: 'traversed',
    });
  });
});
