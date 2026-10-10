# Chapter 1 — Entrance Hall: implementation notes

Implements `docs/story/CHAPTER_1_ENTRANCE_HALL.md`: the corridor, the pannable hall hub, two independent puzzles that each open their own door, and the first version of the living miniature-pyramid map. Destination rooms are intentionally not built; the open doors show passages only.

## Flow

exterior (open door) → `corridor` → `hall` ⇄ `relief-puzzle` / `balance-puzzle`. Title "Fortsätt" resumes at `corridor` or `hall` by save stage. `chapter1-gate` is kept as an archived screen.

| Scene key        | File                                    | Purpose                                                                                                                  |
| ---------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `corridor`       | `src/game/scenes/CorridorScene.ts`      | Corbelled passage (640×360), inscription hotspot, step-forward camera push into the hall.                                |
| `hall`           | `src/game/scenes/HallScene.ts`          | 1600×450 panorama, drag/inertia/keyboard panning, hotspots, map awakening, both door animations, map reactions.          |
| `relief-puzzle`  | `src/game/scenes/ReliefPuzzleScene.ts`  | Near-fullscreen sliding relief with move budget, reset, painted-reference compare, hidden ninth stone rising on success. |
| `balance-puzzle` | `src/game/scenes/BalancePuzzleScene.ts` | Bronze balance, carved relation tablets, weight shelf, lever commit (drag or hold), swing/reroll animation.              |

Review shortcuts: `?scene=corridor|hall|relief-puzzle|balance-puzzle` (add `&renderer=canvas` where WebGL is unavailable).

## Engines (pure, Phaser-free, unit-tested)

- `src/game/puzzles/slidingTiles.ts` — any rows×cols; legal orthogonal slides only; a move is spent only on a legal slide; exhausting the budget resets to the configured layout and full budget. IDA* (Manhattan + linear conflict) gives the exact minimum distance; `validateConfig` rejects unreachable layouts and budgets below the minimum. Tested on 3×3, 4×4 and 3×4.
- `src/game/puzzles/balanceScale.ts` — scarab/falcon/lotus weights, seeded generator with bounded retries and an authored fallback. Every puzzle is checked: relations fix all weight ratios (rank test), the vessel's carved composition cannot be copied from the shelf, the whole shelf is not a solution, at least one inventory-limited solution exists, solution count is capped, and the minimum number of relief substitutions (BFS) matches the configured difficulty. All balancing selections are accepted. `pullLever` is the only feedback; a failure under `reroll-on-fail` advances the attempt counter, which derives the next puzzle's seed. Moving weights never rerolls.
- `src/game/world/pyramidMap.ts` — stable room identities (`ROOMS`) separate from the run graph (`createChapter1Graph(seed)`); `visibleMap()` returns only visited rooms and seen exits; unvisited destinations are `null` stubs. No coordinates in the model.

## Puzzle instances (`src/game/hall/puzzles.ts`)

- **Relief:** 3×3 "offering to the sun": a kneeling figure lifts the miniature toward a winged sun whose rays strike its eye; the right column carries the canonical eye/steps/sun signs. Coloured border bands and gold corner rosettes make edges and corners identifiable. The painted reference is on the wall left of the door (and via "Jämför med målningen" in the close-up). Start layout `[0, ·, 4, 3, 2, 1, 6, 7, 5]` (gap top middle) is built by 7 legal moves from the solved picture; the engine-computed optimal solution is 7 slides and the budget is 14 (asserted in `tests/hallPuzzles.test.ts`). Playtesting showed the earlier 16-move/32-budget start was too hard for the first indoor puzzle; harder 3×3, 4×4 and 3×4 configurations are still validated by tests for later rooms.
  - **No undo** (decision): sliding a stone back is a normal move and costs one. A refunding undo would trivialise the budget.
- **Balance (first weighing, authored):** reliefs "1 scarab = 3 lotus", "1 falcon = 2 lotus", "vessel = 2 scarabs"; shelf 1 scarab, 2 falcons, 4 lotus. Accepted answers: scarab + 3 lotus, scarab + falcon + lotus, 2 falcons + 2 lotus, falcon + 4 lotus. After a failed weighing, generated puzzles follow `FIRST_HALL_BALANCE` (2 relations, 2–3 vessel pieces, depth 1–2, ≤5 solutions).
- **Whole numbers only in the first hall:** `weightModel: 'base-multiples'` makes every weight a whole multiple of the lightest piece (the base unit), and `relationForm: 'one-to-group'` makes every relief one piece against a group of at most 3 ("1 scarab = 1 falcon + 2 lotus"). Reading a relief is always a substitution, never a division; difficulty comes from chaining reliefs. Both settings default to `'free'`, so later rooms can use relations like "2 falcons = 3 scarabs" by configuration.
- Weights are equal-sized discs, so size never hints at weight.

## Map awakening sequence (decision)

1. Arrival caption, a short look-around pan, then the pedestal under the daylight shaft starts to glow and the miniature button pulses.
2. Inspecting the pedestal → "Håll fram miniatyren": the pedestal flares, the great niche relief's gold map lines light up, and the miniature opens in its **inner view**, where seams light from the base and rooms appear one by one (exterior → corridor → hall, with the two closed hall doors as red stubs).
3. Each solved puzzle: after its door opens, the niche flashes, a chip says a new passage was drawn, and the stub turns teal/open. Both solved: a stronger flash and pulsing apex in the cutaway. Nothing beyond the doors is drawn.
4. The map is reachable from the HUD anywhere in the hall after awakening ("Inre vy"), with outer/inner toggle and a zoom. Solving a puzzle before awakening still works; the pedestal then beckons.

Map layout is a projection of graph structure (BFS depth from outside → deeper toward the core; siblings fan out). Positions are not stored per room.

## Art pipeline

```sh
npm run generate:hall-art            # writes public/assets/hall/*.png
node tools/generate-hall-art.mjs --preview <dir>   # also writes review composites
```

Sources: `tools/hall-art/{common,hall,relief,corridor,balance}.mjs`; shared anchors in `src/game/hall/hallLayout.json`; balance signs in `src/game/hall/hallGlyphs.json` (used by the generator for carved sprites). The prologue glyph sheet supplies the eye/steps/sun/moon/map signs, so the friezes, the niche maze and the relief's sign column match the miniature. Output is byte-identical between runs.

Palette: cool indigo recesses → warm torch-lit limestone (`STONE` ramp), lapis ceiling with gold stars, turquoise/ochre-red/gold pigments, bronze for mechanisms. Lighting is a shared light field (braziers, torches, lamp stands, oil lamps, a daylight shaft), so every layer is lit consistently.

### Layers and occlusion

Hall depth order: door passages → door slabs → `hall-back` (with transparent door openings) → relief tiles (runtime) → niche/pedestal glows (add) → `hall-glow` (add, flicker) → flame/spark/mote particles → `hall-front` (architrave + rubble, parallax). The relief door slab **sinks** behind the painted floor; the balance door slab **rises** behind the lintel, so real wall pixels occlude the moving stone (no masks). Dust spills at the moving edge, grit trickles from the lintel, the camera shakes lightly (off with "Minska rörelser"), and coloured air drifts out of each passage afterwards.

## Persistence (save v2)

`PrologueSave` v2 adds `hall` (arrival, map stage, relief cells/moves/solved, balance seed/attempt/placed/solved, doors whose animation played, last hall camera x) and `world` (current room, visited rooms, seen/opened/traversed exits). v1 saves migrate. Revisits show solved relief/open doors without replaying; the hall camera returns to where the player left it.

## Verification done

- `vitest`: 181 tests (engines, generator, persistence, migration, spoiler visibility, hall instances).
- `tsc -b`, `eslint src tests tools`, `vite build`: clean.
- Browser (embedded, **Canvas renderer**; WebGL failed to initialise in this embedded browser, as for the prologue): exterior → corridor → hall flow, arrival, pedestal awakening and cutaway map, relief solved through the UI path (16 slides), relief door sinking, balance correct weighing (equilibrium) and failed weighing (tilt, reroll with new tablets/shelf), balance door rising, both-solved map reaction, portrait 375×812 layouts of hall, relief and balance close-ups.
- Not verified: WebGL rendering path, real phone hardware, audio (cues are hooks only).

## Input: taps must start and end on the same object

Phaser listens for pointer release on `window` and hit-tests the release against game objects, while presses on HTML overlay buttons never reach the canvas. Pressing a caption's "Fortsätt" over a carved tablet therefore delivered a stray release to that tablet, which opened its own caption, and so on: chained, sometimes different, equation dialogs. Weights and tiles under a caption could be moved the same way. Fix: tablets are real HTML buttons positioned over the carvings (one caption per click, keyboard- and screen-reader-accessible via `aria-label`), and weights/tiles act only when the same pointer pressed and released on them (`src/game/hall/tapGuard.ts`). The introduction shows once per save; a failed weighing only shows the short "new signs" line.

## Known limitations / follow-ups

- Map projection is designed for small graphs; deeper levels will need a layout pass once more rooms exist.
- The relief close-up uses a darker scaled wall behind the 1:1 art on tall phones.
