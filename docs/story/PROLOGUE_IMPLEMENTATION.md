# Prologue implementation notes

Implements `docs/story/CHAPTER_1_PROLOGUE.md` (title → attic → miniature → note → travel → exterior → _Ögats ljus_ → entrance reveal → Chapter 1 gate). The indoor hall and the cutaway map are intentionally **not** implemented.

## Flow and scenes

| Scene key       | File                                   | Purpose                                                                                                                                                                |
| --------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`         | `src/game/scenes/TitleScene.ts`        | ENIGMA logo, pyramid silhouette catching dawn, drifting dust. New game / Continue (disabled without a save) / Settings.                                                |
| `intro`         | `src/game/scenes/IntroScene.ts`        | Attic and heirloom box, miniature inspection (drag or buttons), grandfather's note, map flight and desert crossing. "Skip intro" appears once the intro has been seen. |
| `exterior`      | `src/game/scenes/ExteriorScene.ts`     | 1280×360 panorama with parallax, hotspots, hints, inventory, the entrance reveal and the open passage.                                                                 |
| `sun-puzzle`    | `src/game/scenes/SunPuzzleScene.ts`    | Close-up at the pedestal: turn/tilt the miniature until the reflected ray rests on the carved eye.                                                                     |
| `chapter1-gate` | `src/game/scenes/Chapter1GateScene.ts` | Archived hand-off screen (reachable with `?scene=chapter1-gate`). The open door now leads to the Chapter 1 corridor; see `ENTRANCE_HALL_IMPLEMENTATION.md`.            |

The earlier experiments (`menu`, `chamber`, `visual-lab`) are unchanged and reachable from Settings → "Öppna tidigare experiment" or `?scene=menu`.

## Shared systems

- **Canonical engravings**: `src/game/artifact/glyphs.json` (16×16 bitmaps: eye, sun, steps, moon, underside map). Both the runtime and the art generator read it, so the miniature, stele, frieze, pedestal, eye relief and note sketch always show the same signs.
- **Miniature renderer**: `src/game/artifact/miniatureRenderer.ts` is a small software rasteriser that draws the real pyramid geometry with those glyphs, pixel-art shading and the polished seam/inlay at any yaw/pitch. Used in the attic, inventory inspector, puzzle cradle and the reveal.
- **Puzzle logic**: `src/game/puzzles/sunEye.ts` is pure vector math (mirror reflection of the sun off the inlay, traced onto the façade). Exposes init/rotate/tick/serialize and the analytic solution; no Phaser dependency.
- **Save**: `src/game/state/prologueSave.ts` (versioned, sanitised, IndexedDB with localStorage/memory fallback). `src/game/prologue/progress.ts` wraps it for scenes. The miniature is never removed from the inventory; the solved/opened state persists and the reveal plays once.
- **Layout anchors**: `src/game/prologue/exteriorLayout.json` (door, eye, frieze, pedestal, close-up framing) shared by the generator and scenes, so animation layers stay aligned.
- **UI overlay**: `src/game/prologue/overlay.ts` + `prologue.css` – real HTML captions, HUD, panels and hotspot markers (keyboard focusable, ≥44 px touch targets, `aria-live` captions). Text stays crisp over the pixel canvas.
- **Framing**: `src/game/prologue/artView.ts` keeps art scale (cover zoom, never squash). Portrait shows a narrower window of the same scene and pans; the title alone switches to a whole-pyramid portrait framing with generated sky/sand extensions.
- **Audio hooks**: `src/game/prologue/audio.ts` dispatches `enigma:cue` DOM events (`stone-rumble`, `stone-slide`, …). No audio assets yet.

## Art pipeline

All prologue pixel art is generated deterministically:

```sh
node tools/generate-prologue-art.mjs            # writes public/assets/prologue/*.png
node tools/generate-prologue-art.mjs --preview <dir>   # also writes 2x composites for review
```

Sources: `tools/prologue-art/{raster,glyphs,exterior,closeup,story}.mjs`. Layers are separate PNGs (sky, far dunes, main, door slab, passage, eye glow, foreground, close-up background/cradle/pedestal, attic, box states, light shaft, note, map, travel dunes, sprites, title silhouettes). The door slab is cut from the painted façade itself, so it is invisible until it moves.

## Entrance reveal (layering)

Depth order inside the panorama: sky → far dunes → **passage** → **slab** → **jamb shadow** → main façade (with a transparent door hole) → eye glow (add) → beam → foreground. The slab first recedes (jamb shadow fades in, slab darkens) and then slides 40 px left _behind_ the façade, so it is occluded by real wall pixels rather than masked. Dust spawns at the grinding jamb edge and threshold, sand trickles from the lintel, the camera shakes lightly (disabled by "Minska rörelser"), and cool teal air drifts out afterwards.

## Review shortcuts

- `?scene=exterior`, `?scene=sun-puzzle`, `?scene=intro`, `?scene=chapter1-gate`, `?scene=menu`
- `?review=reveal` – replays the entrance reveal once.
- `?renderer=canvas` – forces the Canvas renderer (used for automated checks where WebGL was unavailable).

## Decisions taken that need approval

1. **Pedestal with a bronze cradle.** Instead of the player holding the miniature (hands are hard to draw well and risk a "floating object" look), a sunlit pedestal in front of the pyramid has a bronze cradle that fits the miniature's base. The player turns and tilts the miniature in it. The pedestal carries the eye sign as an extra clue.
2. **Optics.** The polished inlay on the eye face acts as a mirror (with faint red/cyan fringes). From the starting orientation the glint flashes back at the viewer ("right idea, wrong direction"); turning one way the ray first appears in the sky and sweeps down the façade.
3. **Control direction in the puzzle.** Dragging steers the ray (drag right → light moves right) rather than mapping to the object's face direction. Buttons/keys take 4° steps while searching and 1.2° steps once the light is on the stone; drag sensitivity also drops near the eye. Solve tolerance ≈ ±2.5°, with a 0.65 s dwell and gentle snap.
4. **Hotspot markers** are small rings placed beside features (not on the carvings). The door hotspot appears after the frieze has been examined.
5. **Copy.** The approved narration is used verbatim; extra hotspot, hint and UI text in `src/game/prologue/content.ts` is draft.
6. **Panorama scale.** 1280×360 art pixels (3× on a 1080p screen); the pyramid frames the opening view on desktop, portrait starts on the apex and eye.

## Known limitations

- Rendered verification was done with the Canvas renderer in an embedded browser where WebGL failed to initialise for every scene (including the unchanged experiments). The default WebGL path was not visually verified.
- No sound assets; cues are hooks only.
- The Chapter 1 interior is a labelled placeholder by design.
