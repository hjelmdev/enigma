# ENIGMA — Technical design

**Status:** proposed architecture. Implementation may refine module boundaries after the first vertical slice.

## Stack and deployment

- **Phaser** for scene lifecycle, rendering, camera effects, pointer interaction and transitions.
- **TypeScript** for runtime, data, puzzles and validation.
- **Vite** for development and production bundling.
- HTML/CSS/SVG for menus, responsive puzzle controls and accessibility when advantageous.
- **GitHub Pages** static deployment with a GitHub Actions build workflow.
- **IndexedDB** for local, versioned saves; optional memory fallback while developing.
- No Angular, game server, user identity or third-party database in the MVP.

The actual starter project, package versions and workflow are to be created by Codex after inspecting the repository. Avoid inventing an already-working build.

## Conceptual module structure

```text
src/
  main.ts
  game/
    bootstrap.ts
    scenes/             # exploration scenes, focus overlay, map
    world/              # authored room graph and hotspot definitions
    navigation/         # scene transitions / gates
    interactions/       # common hotspot and focus helpers
    puzzles/            # typed puzzle modules + logic
    map/                # discovered cutaway visualization
    state/              # game state and progression rules
    persistence/        # versioned IndexedDB adapters
    ui/                 # dialogs, hint ladder, touch-friendly controls
    assets/             # manifests and placeholders
tests/
public/
  assets/
docs/
```

This tree is an example, not a mandatory file-for-file prescription.

## Data-driven world

Use stable content IDs. Suggested conceptual models:

```ts
type RoomId = string;
type ExitId = string;
type PuzzleId = string;

interface RoomDefinition {
  id: RoomId;
  title: string;
  backgroundAssetId: string;
  mapGeometry: { floor: number; x: number; y: number; width: number; height: number };
  exits: ExitDefinition[];
  hotspots: HotspotDefinition[];
}

interface ExitDefinition {
  id: ExitId;
  destinationRoomId: RoomId;
  requiredPuzzleId?: PuzzleId;
  initiallyUnlocked?: boolean;
  // Do not infer discoverability from unlock state.
  revealRule?: string;
}

interface HotspotDefinition {
  id: string;
  kind: "inspect" | "puzzle" | "secret" | "exit";
  // Coordinates normalized against the authored image reference size.
  area: { x: number; y: number; width: number; height: number };
  targetId?: string;
}
```

Use a distinct model for discovered passages so an undiscovered secret cannot appear on the map just because its exit exists in content data. Validate bidirectional or intentionally one-way graph links.

## Game state and save contract

Prefer serializable plain data with an explicit schema version:

```ts
interface SaveGameV1 {
  version: 1;
  currentRoomId: RoomId;
  discoveredRoomIds: RoomId[];
  discoveredExitIds: ExitId[];
  unlockedExitIds: ExitId[];
  solvedPuzzleIds: PuzzleId[];
  puzzleStates: Record<PuzzleId, unknown>;
  collectedSecretIds: string[];
  difficulty: "explorer" | "thinker";
  savedAt: string;
}
```

This is an illustrative starting point. Keep puzzle state JSON-safe and validated. Preserve save data across reasonable app updates using migrations. Saves must avoid exposing undiscovered rooms. Test refresh and navigation cycles.

## Puzzle interface

Each puzzle should supply:
- configuration and deterministic initial state;
- typed commands or actions;
- pure validation / state transition logic where possible;
- explicit win condition and a clear replay/close behavior;
- serialization and rehydration;
- difficulty-specific authored or solvability-verified configurations;
- contextual hints (observation, reasoning, next step).

Prefer puzzle logic tested without Phaser. Keep UI input and animations outside the core solver.

## Scenes, scaling and controls

- Start with a reference landscape aspect ratio around **16:9** but support varying browser sizes and safe areas.
- Maintain correct hotspot alignment when images scale or pan: normalized coordinates and shared transforms.
- Touch hotspots need comfortable tap targets without overlapping wrong actions.
- Focus interaction: select object → short camera move/zoom/fade → close-up puzzle/inspection → return to room.
- Keyboard navigation or accessible HTML control alternatives for important actions.
- Do not bake critical text or exact gameplay symbols into AI-generated scene art; use overlays.

## Map rendering

The map reads only **discovery state** plus authored geometry. Unknown rooms/corridors are hidden, not merely greyed out. Pan/zoom should not reveal geometry of secret areas. Display visited rooms and per-room known exits/status; avoid spoilers.

## Testing

- Pure tests for each puzzle's legal moves, win detection, reset and guaranteed solvability.
- World graph validation: unique IDs, valid destinations, reachable initial path, intentional gates.
- Save round-trip and corrupt/outdated data handling.
- Browser interaction smoke tests: mouse and touch; room return; zoom target alignment.
- Production build and GitHub Pages base path sanity checks for `/enigma/`.

## Future-facing but not MVP

Potential cloud save and cross-device continuity can be designed later. Keep persistence behind an adapter but do not prematurely deploy servers or authentication.
