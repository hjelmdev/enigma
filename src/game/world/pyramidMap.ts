import type { WorldSave } from '../state/prologueSave';

export type RoomKind = 'outside' | 'passage' | 'hall' | 'chamber';
export interface RoomIdentity {
  id: string;
  kind: RoomKind;
  name: string; // Swedish display name
}

export const ROOMS: Record<string, RoomIdentity> = {
  exterior: { id: 'exterior', kind: 'outside', name: 'Utsidan' },
  'entrance-passage': {
    id: 'entrance-passage',
    kind: 'passage',
    name: 'Ingångsgången',
  },
  'entrance-hall': { id: 'entrance-hall', kind: 'hall', name: 'Stora hallen' },
  'chamber-of-stars': {
    id: 'chamber-of-stars',
    kind: 'chamber',
    name: 'Stjärnornas kammare',
  },
};

/** to=null: destination unresolved / not built in this run. */
export interface ExitDef {
  id: string;
  from: string;
  to: string | null;
}
export interface RunGraph {
  seed: number;
  exits: ExitDef[];
}

export const EXIT = {
  entrance: 'exterior-entrance',
  passageToHall: 'passage-hall',
  reliefDoor: 'hall-relief-door',
  balanceDoor: 'hall-balance-door',
  starsReturn: 'stars-hall-return',
} as const;

/** Fixed today; seed is reserved for future run variation. */
export function createChapter1Graph(seed = 0): RunGraph {
  return {
    seed,
    exits: [
      { id: EXIT.entrance, from: 'exterior', to: 'entrance-passage' },
      { id: EXIT.passageToHall, from: 'entrance-passage', to: 'entrance-hall' },
      { id: EXIT.reliefDoor, from: 'entrance-hall', to: null },
      { id: EXIT.balanceDoor, from: 'entrance-hall', to: 'chamber-of-stars' },
      { id: EXIT.starsReturn, from: 'chamber-of-stars', to: 'entrance-hall' },
    ],
  };
}

export function exitsOf(graph: RunGraph, roomId: string): ExitDef[] {
  return graph.exits.filter((e) => e.from === roomId);
}

export type LinkState = 'traversed' | 'open' | 'closed';
export interface MapRoom {
  id: string;
  kind: RoomKind;
  name: string;
  current: boolean;
}
export interface MapLink {
  exitId: string;
  from: string;
  to: string | null; // null unless the destination room is visited
  state: LinkState;
}
export interface MapView {
  rooms: MapRoom[];
  links: MapLink[];
}

/** Spoiler-safe: only visited rooms and known exits adjacent to them. */
export function visibleMap(graph: RunGraph, world: WorldSave): MapView {
  const visited = new Set(world.visitedRooms);
  const seen = new Set([
    ...world.seenExits,
    ...world.openedExits,
    ...world.traversedExits,
  ]);
  const opened = new Set(world.openedExits);
  const traversed = new Set(world.traversedExits);

  const rooms: MapRoom[] = [];
  for (const id of world.visitedRooms) {
    const identity = ROOMS[id];
    if (!identity || rooms.some((r) => r.id === id)) continue;
    rooms.push({
      id,
      kind: identity.kind,
      name: identity.name,
      current: id === world.currentRoom,
    });
  }

  const links: MapLink[] = [];
  for (const exit of graph.exits) {
    if (!seen.has(exit.id)) continue;
    const toVisited = exit.to !== null && visited.has(exit.to);
    if (!visited.has(exit.from) && !toVisited) continue;
    links.push({
      exitId: exit.id,
      from: exit.from,
      to: toVisited ? exit.to : null,
      state: traversed.has(exit.id)
        ? 'traversed'
        : opened.has(exit.id)
          ? 'open'
          : 'closed',
    });
  }
  return { rooms, links };
}
