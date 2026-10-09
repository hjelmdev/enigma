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

The current vertical slice keeps room content in `world/rooms.ts`, layered
presentation in `presentation/RoomRenderer.ts`, and puzzle rules in pure functions under
`puzzles/logic.ts`. Phaser panels in `ui/` present those rules. The in-memory
`state/session.ts` records visited rooms and solved puzzle IDs until a page
reload; versioned durable storage remains a later milestone.

Room presentation separates the replaceable background from authored
architecture, object artwork, doorway frames, door leaves, opening reveals and
atmosphere. `RoomPresentationDefinition` stores visual object bounds and
doorway dimensions separately from hotspot interaction bounds. A room may set
`backgroundImage` to a public asset path; the chamber scene preloads it and
renders it beneath optional foreground layers. When unset or unavailable, the
palette-based stone treatment is used. Gameplay symbols and hit areas stay in
data and Phaser overlays, so a generated background can be swapped without
changing puzzle logic.

Each `DoorView` owns a visual state (`closed`, `opening`, or `open`), a reveal
layer, and independently animated stone leaves. A solved exit plays the shared
open sequence; revisiting a room derives the initial `open` state from session
progress. Unlock state and door art remain separate from hotspot rendering.

## Data-driven world

Use stable content IDs. Suggested conceptual models:

```ts
type RoomId = string;
type ExitId = string;
type PuzzleId = string;

interface RoomDefinition {
  id: RoomId;
  title: string;
  background: { top: number; bottom: number; wall: number; accent: number };
  presentation: RoomPresentationDefinition;
  worldBounds: { x: number; y: number; width: number; height: number };
  intro: string;
  mapGeometry: {
    floor: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  exits: ExitDefinition[];
  hotspots: HotspotDefinition[];
}

interface ExitDefinition {
  id: ExitId;
  destinationRoomId: RoomId | 'ending';
  requiredPuzzleId?: PuzzleId;
  initiallyUnlocked?: boolean;
  // Do not infer discoverability from unlock state.
  revealRule?: string;
}

interface HotspotDefinition {
  id: string;
  label: string;
  description: string;
  // Authored world-space geometry, independent of viewport dimensions.
  area: { x: number; y: number; width: number; height: number };
  focus: { x: number; y: number; zoom: number };
  puzzleId?: PuzzleId;
  exitId?: ExitId;
}

interface RoomPresentationDefinition {
  backgroundImage?: string;
  columns: number[];
  alcoves: number[];
  torchPositions: number[];
  objects: RoomObjectDefinition[];
  doorways: { exitId: ExitId; width: number; height: number }[];
}

interface RoomPresentationDefinition {
  backgroundImage?: string;
  columns: number[];
  alcoves: number[];
  torchPositions: number[];
  objects: RoomObjectDefinition[];
  doorways: DoorwayArtDefinition[];
}

interface DoorwayArtDefinition {
  exitId: ExitId;
  width: number;
  height: number;
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
  difficulty: 'explorer' | 'thinker';
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

- Support desktop and mobile in **portrait and landscape**. Do not require device rotation.
- Author each room in one shared world coordinate system with explicit world bounds. Hotspot areas and focus points use world coordinates and stay fixed as the viewport changes.
- Use a pan-able 2D camera whose viewport follows the available screen size while the authored room keeps its scale. Wide screens see more of the room; narrow portrait screens see a narrower slice of the same room.
- Constrain camera movement to the room's world bounds. Keep vertical framing stable and pan horizontally when the room exceeds the viewport.
- Distinguish a tap from a swipe with a 14 px screen-space threshold and lock the gesture direction once crossed. Horizontal and moderately diagonal swipes pan the room; vertical gestures do not activate hotspots. A gesture may start anywhere over the game, including the header and footer; taps in those UI bands remain UI-only.
- Show screen-bound left/right cues only while more room can be explored in that direction. Start each room with its first authored visual focus in view as a stable orientation reference. Clamp the camera using the visible world width at its current zoom.
- Keep navigation hints, inspection controls and other interface elements in a separate screen-space layer. They must not move with the room camera.
- Touch hotspots need comfortable tap targets without overlapping wrong actions.
- Focus interaction: save camera position → move/zoom to the selected world-space focus point → show a screen-bound close-up with an always-visible return control → restore the prior camera position.
- The game canvas and its parent fill the browser viewport, including mobile safe areas, without document scrollbars or uncovered space outside the game area.
- Keyboard navigation or accessible HTML control alternatives for important actions.
- Do not bake critical text or exact gameplay symbols into AI-generated scene art; use overlays.

## Map rendering

The map reads only **discovery state** plus authored geometry. Unknown rooms/corridors are hidden, not merely greyed out. Pan/zoom should not reveal geometry of secret areas. Display visited rooms and per-room known exits/status; avoid spoilers.

The current map is a schematic triangle and displays rooms visited during the
current session. Its room positions and status indicators are a first cut, not
final cartography.

## Testing

- Pure tests for each puzzle's legal moves, win detection, reset and guaranteed solvability.
- World graph validation: unique IDs, valid destinations, reachable initial path, intentional gates.
- Save round-trip and corrupt/outdated data handling.
- Browser interaction smoke tests at desktop and portrait/landscape mobile sizes: horizontal pan bounds, tap/swipe threshold, hotspot alignment after panning, focus from different camera positions, screen-bound UI and room return.
- Production build and GitHub Pages base path sanity checks for `/enigma/`.

## Future-facing but not MVP

Potential cloud save and cross-device continuity can be designed later. Keep persistence behind an adapter but do not prematurely deploy servers or authentication.
