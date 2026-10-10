# The Sealed Sun — clean-room room-art experiment

**Status:** experiment, separate from the main adventure and the Visual Lab.
Its art, puzzle and text are proposals, not approved canon. Nothing in it
was derived from the Visual Lab's art, palette, composition, puzzle or door.

One chamber, one puzzle, one door, built to test how far programmatic
**HD pixel art** can go: a chamber you can pan, a stele with the clue, a
three-ring Sun Seal in close-up, and a rose-granite slab that sinks into the
floor to reveal a sunlit stair.

## How to test it

- `npm run dev`, then pick **Experiment · Solkammaren** in the menu (on short
  screens it is the gold button in the top-right corner), or open
  `/?experiment=sealed-sun` directly.
- Drag to pan (14 px threshold separates a pan from a tap). Tap the stele,
  the seal stand or the door. Keyboard: ←/→ moves between them, Enter
  inspects, Esc closes a close-up.
- In the seal close-up: tap a ring (or the Yttre/Mellersta/Inre buttons) to
  select it, then ⟲/⟳, or drag along a ring. Keyboard: ↑/↓ select, ←/→ turn,
  H hint.
- Solution, for testing: outer ring ⟲ ×3, middle ⟲ ×3, inner ⟳ ×1 from a
  fresh start.
- ↺ in the top bar resets the experiment's saved state.

## The puzzle

The bronze window at twelve o'clock shows one glyph per ring, read top to
bottom: outer, middle, inner. The stele on the left wall shows the dawn
image (Khepri): **sun disc above scarab above mountains**. Setting the window
to that image opens the door.

The insight is mechanical. Each ring is pinned to the ring inside it:
turning the outer ring also turns the middle one, turning the middle ring
also turns the inner one, and the inner ring turns alone. Working outside-in
always solves it in at most 12 moves (tested over all 512 states). The ring
inlays use the stele's colours (gold, lapis, ochre) to help younger players.
A three-step hint ladder goes observe → reason → next step. The caption names
the glyphs in the window after each turn, so the puzzle does not depend on
seeing small shapes alone.

Rules live in `src/experiments/sealed-sun/puzzle/sunSeal.ts` (pure, no
Phaser): definition validation, `turn`, `isSolved`, `solve`, serialization.

## How the art is generated

Everything is drawn by code into plain RGBA buffers (`art/pixelCanvas.ts`),
one buffer pixel per art pixel. The room is 560×300 art pixels. Nothing is
random at runtime: every decision uses a seeded PRNG or a coordinate hash, so
the same code always yields the same pixels (a test checks this).

- **Real perspective.** `layout.ts` models the chamber as a box seen in
  one-point perspective. `art/roomArt.ts` casts a ray through every art pixel
  into that box. Walls, floor and ceiling are coursed masonry in surface
  coordinates (`art/masonry.ts`), so blocks, joints and reliefs foreshorten
  correctly. Joints are wherever the block id changes between neighbouring
  pixels, which gives crisp 1 px mortar lines and lit/shaded block edges at
  any depth.
- **One light model.** `art/lighting.ts` lights every baked layer with the two
  torches, a faint cool ambient and a viewer fill. Then come ambient
  occlusion at creases and a foreground falloff that keeps the doorway the
  brightest thing in the room.
- **Material maps, not colours.** Reliefs (stele, inscriptions, door frame,
  slab carving) are `MaterialMap`s (`art/materialMap.ts`): each pixel names a
  ramp plus a step offset. The same stele map is lit by the torches in
  perspective on the wall and shaded flat in its close-up, so the clue in the
  room and the clue in the close-up are the same object.
- **Hand-authored where it matters.** The 23 hieroglyphs (`art/glyphs.ts`) are
  hand-drawn 13×13 bitmaps, the only puzzle-critical shapes.
- **Seal close-up.** `art/sealArt.ts` redraws the rings analytically at any
  angle instead of rotating a sprite, so they stay pixel-crisp while turning.
  Glyphs stay upright, like numerals on a dial.

To export every layer as PNG (art size and 4×) for review:

```sh
npm run art:sealed-sun            # writes ./sealed-sun-art (git-ignored)
```

This needs Node 23.6+ (it runs the TypeScript generators directly). The game
does not use these PNGs. It runs the same generators in the browser on first
entry, which takes a few hundred ms behind a short loading line.

## Palette

`art/palette.ts` defines named, hue-shifted ramps. Shadows lean indigo/slate
and lights lean ochre/cream, so depth reads in temperature as well as value:

| Ramp                       | Role                                                             |
| -------------------------- | ---------------------------------------------------------------- |
| limestone                  | walls and floor (the main surface)                               |
| sandstone                  | door frame, plinth, seal plate: warmer, sets the frame apart     |
| granite                    | the door slab and seal stand: Aswan rose granite                 |
| ceiling                    | lapis-painted ceiling with gold stars                            |
| gold                       | inlay, sun discs, the activation light, daylight beyond the door |
| lapis, turquoise, ochreRed | painted friezes, inscriptions, wing feathers                     |
| bronze                     | torch brackets, the seal's window                                |
| fire                       | flames and glow                                                  |
| void, sand                 | recesses, slots, sand drifts and draining sand                   |

Light picks a ramp step through a narrow ordered dither (`quantize`), so
bands stay mostly solid and only their seams dither.

## Door layering

Back to front:

1. **corridor**: the ascending passage, ray-cast separately and lit from its
   top (`art/doorArt.ts`).
2. **slab**: rose granite with an Aten sun and cartouche. It slides down.
3. **slabGlow**: the slab's gold inlay at full brightness, faded in on
   activation and moving with the slab.
4. **room**: the whole chamber with a transparent hole exactly the size of
   the doorway at the slab plane. The threshold and floor below that hole are
   opaque, so the sinking slab disappears behind real geometry. No masks or
   crops are needed, and nothing can overlap incorrectly.
5. **light**: the floor spill (each pixel stores where its sun ray crosses the
   doorway, so the lit patch grows exactly as the opening widens), the dusty
   beam, and the floor channel.
6. **props and motion**: seal stand, live seal miniature, torch glows and
   flames, dust and sand particles, inspect glints.

Opening sequence (`scenes/SealedSunScene.ts`):

1. The seal locks and glows.
2. The view returns to the room, and light runs along the gold channel in the
   floor from the stand to the threshold.
3. The slab's sun ignites and the camera centres on the door.
4. A rumble, with sand pouring from the two sand-lock vents.
5. A 2 px jolt.
6. A 4.2 s grind down into the floor slot, with eased start and stop and
   shake pulses. Dust rises from the slot and falls from the lintel, while
   the floor spill and beam grow.
7. A heavy stop: a strong shake, a dust burst and a 2 px settle.

The open state is saved and restored on revisit. Reduced-motion users get no
shake and fewer particles.

## Relationship to the Gravity Run reference

Concepts taken (no code, art or content copied):

- palettes as explicit, named resources that the art code reads;
- seeded, deterministic generators kept in the repository and re-runnable;
- art generation kept separate from gameplay (hotspots and puzzle rules never
  read pixels);
- a consistent pixel-art language: one highlight step and one shade step,
  outlines where shapes must read, structured detail instead of noise;
- a review/export tool beside the generator.

## Layout and mobile

The camera zoom always fills the viewport height, so there is never
letterboxing. Wide screens see more of the room and portrait phones pan
across it, with momentum capped and cancelled when the finger rests before
release. UI is DOM (`ui/overlay.ts`): 48 px targets, keyboard focus, and
screen-fixed text. On short landscape phones the close-up controls move
beside the seal, and the narrative panel steps aside after a few seconds.

## Known limitations

- Zoom is fractional, so on some screens art pixels are not all the same size
  (nearest filtering, rounded camera).
- No sound yet. The door sequence was designed to take a rumble and a heavy
  stop sound.
- Progress uses its own `localStorage` key, separate from the main
  adventure's future IndexedDB saves.
- Text is Swedish placeholder copy.
