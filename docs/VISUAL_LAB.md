# ENIGMA Visual Lab

Visual Lab is a presentation experiment, separate from the three-room adventure
session. It uses one `SEALED_SUN_ROOM` world geometry and one Sun Seal rule set
for every style. Styles only select a `RoomArtPack`; they do not fork puzzle or
door logic.

## Art layers

`src/game/scenes/VisualLabScene.ts` composes the room in this order: raster
chamber background, optional corridor reveal, two independent stone leaves,
door frame overlay, mechanism/clue/vessel layers, and transient dust. The frame
stays in front of moving slabs so the leaves disappear behind the masonry.
Hotspots and the three ring hit areas remain in room-world coordinates. Header,
status and controls are in a camera-fixed container.

The illustrated selection deliberately has no fake art pack. The same layer
slots accept approved background, corridor, frame, leaf and object files later;
effects and interaction data remain separate. Supply imagery at the documented
960 x 480 room composition (or use `RoomArtPack` paths to provide equivalent
layers), preserve transparent margins on overlays, and update only the asset
manifest/pack mapping.

## Pixel-art styles

- **Classic** is authored on a 320 x 160 raster with a compact, shared palette,
  clear clusters, coarse masonry, simple reliefs and sparse light/stone texture.
- **HD** is drawn independently at 640 x 320 using a related but deeper palette,
  denser masonry and carved detail, more granular surface texture, and broader
  torch pools. It renders with nearest-neighbour filtering at the same world
  size; it is not a blurred upscale of Classic.

The PNG generator uses only Node built-ins, a fixed pseudo-random seed, explicit
palettes and reusable raster drawing helpers. Generated visual assets are
committed under `public/assets/visual-lab/{classic,hd}`. Regenerate them with:

```sh
npm run generate:visual-lab-art
```

The static PNGs contain the room architecture, carved slabs, relief, vessel and
mechanism. Door motion, shared puzzle symbols/rotations, reveal timing, dust,
small glow, camera shake and UI hover/press feedback are rendered at runtime by
Phaser. No final illustrated or AI-generated artwork is included.

## Puzzle and door state

The Sun Seal puzzle is a pure model in `src/game/visual-lab/model.ts`. Its three
rings advance independently through four directions. The relief provides the
directional clue. A correct arrangement transitions the door through
`closed -> opening -> open`; the two source leaf textures slide behind the
frame, while the corridor fades in and a brief dust/shake sequence sells the
stone movement. Open remains visible until reset. Reset restarts the lab room
and puzzle; style selection and the main adventure remain separate.

## Inspiration study

Techniques were studied from the `claude/analys-och-forbattringar` branch of
[`hjelmdev/gravity-run`](https://github.com/hjelmdev/gravity-run/tree/claude/analys-och-forbattringar):
semantic cached palettes, deterministic seeded details, reusable pixel shapes,
layered biome backgrounds, nearest-filtered generated textures, and keeping art
generation/data separate from gameplay. ENIGMA's generator is a fresh TypeScript
implementation; Gravity Run assets and code were not copied or modified.
