# ENIGMA Visual Lab

Visual Lab is a presentation experiment, separate from the three-room adventure
session. It uses one `SEALED_SUN_ROOM` geometry and one Sun Seal rule set for
Classic and HD; styles select only a replaceable `RoomArtPack`.

## Layered presentation

`VisualLabScene` composes the raster chamber background, optional corridor
reveal, two independent door leaves, frame/occlusion layer, mechanism, clue,
vessel and transient particles. The frame stays in front of moving slabs so
they disappear behind masonry. The room mechanism is an inspection hotspot;
ring controls never appear in the wide room. A brief camera focus leads into a
screen-fixed close-up with large rotary discs. Closing and reopening the view
preserves the pure model state. Header, status, close-up and controls remain
fixed as the world camera pans.

The chamber keeps one 960 x 480 world across orientations. A portrait viewport
shows a narrower crop; horizontal drag pans within bounds, and a small velocity
decays smoothly after release. A 12 px movement threshold suppresses taps after
a drag, while the recenter control returns to the doorway.

The Illustrated choice intentionally has no fake art pack. Its integration
slots accept approved background, corridor, frame, leaf and object art later.
Supply a background composed for the 960 x 480 room, transparent margins on
overlays, and change the art pack mapping only; puzzle data and interactions
stay separate.

## Pixel art and palette

- **Classic** is authored at 320 x 160 with compact warm sandstone, ochre and
  gold, simplified silhouettes, coarse masonry and sparse pixel clusters.
- **HD** is independently drawn at 640 x 320. Limestone and amber highlights
  sit against blue-grey recesses; lapis/turquoise inlay is reserved for sacred
  details. Relief panels, a narrow amber floor path, torch pools and more
  dimensional materials create a different composition rather than a larger
  Classic image.

The deterministic Node generator uses a fixed seed, semantic palette objects,
shared raster drawing helpers and authored layers. Nearest-neighbour filtering
preserves deliberate pixel clusters. Generated PNGs live under
`public/assets/visual-lab/{classic,hd}`. Regenerate with:

```sh
npm run generate:visual-lab-art
```

The PNGs contain architecture, carved slabs, clue relief, vessel, room pedestal,
dedicated three-socket puzzle backing and rotary disc art. Phaser handles camera transitions, animated rotation, door
motion, reveal timing, dust, glow, camera emphasis, UI and hover feedback. There
are no final illustrated or AI-generated assets or sound files.

## Sun Seal puzzle and door

The pure model lives in `src/game/visual-lab/model.ts`. Three large close-up
discs rotate independently through N/E/S/W with animated quarter-turns and a
brief tactile pulse. A progressive hint ladder first points to the relief,
then explains the relationship, then suggests the first move.

The relief shows three suns from left to right: sunrise points east, noon points
to the top of the relief, and sunset points west. The intended solution is
**[E, N, W]**, encoded **[1, 0, 3]**. The starting state is **[N, S, E]**, so
each disc needs deliberate movement. The intended insight is to follow the
sun's path and read the relief's rays, not guess a numeric code. This reasoning
is development documentation; player-facing copy uses the relief and staged
hints.

When solved, model state records the transition and increments `unlockCount`
exactly once. The close-up closes, the camera emphasizes the gate, the hidden
passage fades in, and two source slabs slide behind the frame using a heavy
two-stage ease. Dust emits at the lintel and a skip control completes the same
open state. Runtime events `visual-lab:seal-turn`,
`visual-lab:seal-activate` and `visual-lab:stone-grind` are sound-ready hooks.
Reset restores the initial puzzle and closed door; adventure state is separate.
Tests cover correct and incorrect arrangements, legal rotations, preserved
progress, reset and the one-time unlock.

## Gravity Run technique study

Techniques were studied in the `claude/analys-och-forbattringar` branch of
[`hjelmdev/gravity-run`](https://github.com/hjelmdev/gravity-run/tree/claude/analys-och-forbattringar):
semantic palettes, deterministic detail, reusable pixel shapes, layered
backgrounds, nearest-filtered generated textures, and separating art generation
from gameplay. The ENIGMA generator is a new Node implementation; no Gravity
Run code or assets were copied or modified.
