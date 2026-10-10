import { describe, expect, it } from 'vitest';
import {
  EXIT,
  ROOMS,
  createChapter1Graph,
  visibleMap,
} from '../src/game/world/pyramidMap';
import type { MapView } from '../src/game/world/pyramidMap';
import type { WorldSave } from '../src/game/state/prologueSave';

const graph = createChapter1Graph();

function world(over: Partial<WorldSave> = {}): WorldSave {
  return {
    currentRoom: 'exterior',
    visitedRooms: ['exterior'],
    seenExits: [],
    openedExits: [],
    traversedExits: [],
    ...over,
  };
}

function linkFor(view: MapView, exitId: string) {
  return view.links.find((l) => l.exitId === exitId);
}

const ALL_ROOMS = ['exterior', 'entrance-passage', 'entrance-hall'];
const ALL_EXITS = [
  EXIT.entrance,
  EXIT.passageToHall,
  EXIT.reliefDoor,
  EXIT.balanceDoor,
];

describe('fresh world (only the exterior visited)', () => {
  it('shows only the exterior room, as current, and no links', () => {
    const view = visibleMap(graph, world());
    expect(view.rooms).toEqual([
      { id: 'exterior', kind: 'outside', name: 'Utsidan', current: true },
    ]);
    expect(view.links).toEqual([]);
  });

  it('never reveals passage or hall rooms, even though the graph contains them', () => {
    const view = visibleMap(graph, world());
    const ids = view.rooms.map((r) => r.id);
    expect(ids).not.toContain('entrance-passage');
    expect(ids).not.toContain('entrance-hall');
  });
});

describe('exit visibility', () => {
  it('an unseen exit is absent entirely, not shown as a stub', () => {
    const view = visibleMap(graph, world());
    expect(linkFor(view, EXIT.entrance)).toBeUndefined();
  });

  it('a seen exit from a visited room shows as closed with to=null while the destination is unvisited', () => {
    const view = visibleMap(graph, world({ seenExits: [EXIT.entrance] }));
    expect(linkFor(view, EXIT.entrance)).toEqual({
      exitId: EXIT.entrance,
      from: 'exterior',
      to: null,
      state: 'closed',
    });
  });

  it('an opened exit shows as open and a traversed exit as traversed', () => {
    const opened = visibleMap(graph, world({ openedExits: [EXIT.entrance] }));
    expect(linkFor(opened, EXIT.entrance)?.state).toBe('open');

    const traversed = visibleMap(
      graph,
      world({ traversedExits: [EXIT.entrance] }),
    );
    expect(linkFor(traversed, EXIT.entrance)?.state).toBe('traversed');
  });

  it('traversed takes precedence over opened, which takes precedence over closed', () => {
    const view = visibleMap(
      graph,
      world({
        seenExits: [EXIT.entrance],
        openedExits: [EXIT.entrance],
        traversedExits: [EXIT.entrance],
      }),
    );
    expect(linkFor(view, EXIT.entrance)?.state).toBe('traversed');
  });

  it('`to` becomes the destination id only once that room is visited', () => {
    const unvisited = visibleMap(graph, world({ seenExits: [EXIT.entrance] }));
    expect(linkFor(unvisited, EXIT.entrance)?.to).toBeNull();

    const visited = visibleMap(
      graph,
      world({
        currentRoom: 'entrance-passage',
        visitedRooms: ['exterior', 'entrance-passage'],
        seenExits: [EXIT.entrance],
      }),
    );
    expect(linkFor(visited, EXIT.entrance)?.to).toBe('entrance-passage');
    expect(visited.rooms.map((r) => r.id)).toEqual([
      'exterior',
      'entrance-passage',
    ]);
  });

  it('a seen passage-to-hall exit from a visited passage stays a stub until the hall is visited', () => {
    const view = visibleMap(
      graph,
      world({
        currentRoom: 'entrance-passage',
        visitedRooms: ['exterior', 'entrance-passage'],
        seenExits: [EXIT.passageToHall],
      }),
    );
    expect(linkFor(view, EXIT.passageToHall)).toEqual({
      exitId: EXIT.passageToHall,
      from: 'entrance-passage',
      to: null,
      state: 'closed',
    });
  });
});

describe('hall door stubs', () => {
  const inHall = {
    currentRoom: 'entrance-hall',
    visitedRooms: ['exterior', 'entrance-passage', 'entrance-hall'],
  };

  it('a seen relief door shows as a closed stub that does not reveal a destination', () => {
    const view = visibleMap(
      graph,
      world({ ...inHall, seenExits: [EXIT.reliefDoor] }),
    );
    expect(linkFor(view, EXIT.reliefDoor)).toEqual({
      exitId: EXIT.reliefDoor,
      from: 'entrance-hall',
      to: null,
      state: 'closed',
    });
  });

  it('a seen balance door shows as a closed stub, and opening it makes it open', () => {
    const seen = visibleMap(
      graph,
      world({ ...inHall, seenExits: [EXIT.balanceDoor] }),
    );
    expect(linkFor(seen, EXIT.balanceDoor)?.state).toBe('closed');

    const opened = visibleMap(
      graph,
      world({
        ...inHall,
        seenExits: [EXIT.balanceDoor],
        openedExits: [EXIT.balanceDoor],
      }),
    );
    expect(linkFor(opened, EXIT.balanceDoor)).toEqual({
      exitId: EXIT.balanceDoor,
      from: 'entrance-hall',
      to: null,
      state: 'open',
    });
  });

  it('hall doors never produce a room entry, even when opened or traversed', () => {
    const view = visibleMap(
      graph,
      world({
        ...inHall,
        seenExits: [EXIT.reliefDoor, EXIT.balanceDoor],
        openedExits: [EXIT.reliefDoor, EXIT.balanceDoor],
        traversedExits: [EXIT.balanceDoor],
      }),
    );
    expect(view.rooms.map((r) => r.id)).toEqual([
      'exterior',
      'entrance-passage',
      'entrance-hall',
    ]);
    expect(
      view.links
        .filter((l) => l.from === 'entrance-hall')
        .every((l) => l.to === null),
    ).toBe(true);
  });
});

describe('room list and current flag', () => {
  it('marks only the current room as current, and lists visited rooms in visit order', () => {
    const view = visibleMap(
      graph,
      world({
        currentRoom: 'entrance-passage',
        visitedRooms: ['exterior', 'entrance-passage'],
      }),
    );
    expect(view.rooms).toEqual([
      { id: 'exterior', kind: 'outside', name: 'Utsidan', current: false },
      {
        id: 'entrance-passage',
        kind: 'passage',
        name: 'Ingångsgången',
        current: true,
      },
    ]);
  });

  it('no room is current when the current room is not among the visited rooms', () => {
    const view = visibleMap(
      graph,
      world({ currentRoom: 'entrance-hall', visitedRooms: ['exterior'] }),
    );
    expect(view.rooms.every((r) => !r.current)).toBe(true);
  });

  it('room metadata matches the identity table', () => {
    const view = visibleMap(
      graph,
      world({
        visitedRooms: ['exterior', 'entrance-passage', 'entrance-hall'],
      }),
    );
    for (const room of view.rooms) {
      expect(room.kind).toBe(ROOMS[room.id].kind);
      expect(room.name).toBe(ROOMS[room.id].name);
    }
  });

  it('ignores unknown room ids and duplicate visits', () => {
    const view = visibleMap(
      graph,
      world({ visitedRooms: ['exterior', 'exterior', 'nowhere'] }),
    );
    expect(view.rooms.map((r) => r.id)).toEqual(['exterior']);
  });
});

describe('rooms that were never visited stay hidden', () => {
  it('a traversed flag on an exit into an unvisited room does not reveal that room', () => {
    const view = visibleMap(
      graph,
      world({ traversedExits: [EXIT.entrance, EXIT.passageToHall] }),
    );
    expect(view.rooms.map((r) => r.id)).toEqual(['exterior']);
    // Entrance is traversed out of a visited exterior, so it stays visible as a stub.
    expect(linkFor(view, EXIT.entrance)).toEqual({
      exitId: EXIT.entrance,
      from: 'exterior',
      to: null,
      state: 'traversed',
    });
    // Passage-to-hall touches no visited room, so it must stay absent.
    expect(linkFor(view, EXIT.passageToHall)).toBeUndefined();
  });
});

describe('invariants over every combination of visited rooms and exit flags', () => {
  it('holds for all subsets of rooms and all exit flag combinations', () => {
    // Visited subsets: 2^3. Exit flags: (seen, opened, traversed) per exit, 8^4 combinations.
    for (let roomMask = 0; roomMask < 1 << ALL_ROOMS.length; roomMask++) {
      const visited = ALL_ROOMS.filter((_, i) => roomMask & (1 << i));
      for (let flags = 0; flags < 8 ** ALL_EXITS.length; flags++) {
        const seen: string[] = [];
        const opened: string[] = [];
        const traversed: string[] = [];
        ALL_EXITS.forEach((exitId, i) => {
          const f = Math.floor(flags / 8 ** i) % 8;
          if (f & 1) seen.push(exitId);
          if (f & 2) opened.push(exitId);
          if (f & 4) traversed.push(exitId);
        });
        const currentRoom = visited[0] ?? 'exterior';
        const save = world({
          currentRoom,
          visitedRooms: visited,
          seenExits: seen,
          openedExits: opened,
          traversedExits: traversed,
        });
        const view = visibleMap(graph, save);

        // Rooms: exactly the visited set, in visit order.
        expect(view.rooms.map((r) => r.id)).toEqual(visited);

        // Links: an exit appears iff it is known and touches a visited room.
        const visitedSet = new Set(visited);
        for (const exit of graph.exits) {
          const known =
            seen.includes(exit.id) ||
            opened.includes(exit.id) ||
            traversed.includes(exit.id);
          const touches =
            visitedSet.has(exit.from) ||
            (exit.to !== null && visitedSet.has(exit.to));
          const link = linkFor(view, exit.id);
          if (!known || !touches) {
            expect(link).toBeUndefined();
            continue;
          }
          expect(link).toBeDefined();
          // `to` is revealed only when the destination is visited.
          const expectedTo =
            exit.to !== null && visitedSet.has(exit.to) ? exit.to : null;
          expect(link!.to).toBe(expectedTo);
          // Stub destinations never leak a room id.
          if (link!.to !== null) expect(visitedSet.has(link!.to)).toBe(true);
          // State precedence: traversed > open > closed.
          const expectedState = traversed.includes(exit.id)
            ? 'traversed'
            : opened.includes(exit.id)
              ? 'open'
              : 'closed';
          expect(link!.state).toBe(expectedState);
        }
      }
    }
  });
});
