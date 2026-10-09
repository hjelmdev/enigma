# ENIGMA — Art direction and asset workflow

**Status:** creative direction, not a final approved asset library.

## Visual identity

A modern, cinematic **illustrated-realism** adventure inside an ancient Egyptian pyramid. Sandstone, carved geometry, deep shadows, restrained gold highlights and pools of torchlight establish curiosity and mystery. Aim for a beautifully crafted illustrated game, not hyperrealistic pre-rendered 3D, oversaturated children's cartoons, or SNES pixel art.

The frame should feel intriguing at first glance yet have clear, tappable points of interest.

## Palette, lighting and atmosphere

- Warm limestone and sand hues, dusty ochre and occasional aged gold.
- Charcoal and near-black recesses to preserve dramatic depth.
- Light shafts, subtle particles, uneven torch glow and restrained ambient motion.
- Ancient inscriptions and motifs should be coherent and purposeful, not random decoration.
- Tone shifts across areas: entrance daylight, torchlit halls, sealed chambers, subterranean mystery.

## Scene composition

- Fixed-viewpoint backgrounds of rooms, corridors and object close-ups.
- Leave visual space for UI and interaction labels; important hotspots must be distinguishable.
- Different vantage points are welcome. Room art need not share one rigid angle.
- Some panoramic/oversized chamber scenes may pan or swipe on mobile.
- Compose rooms so their focal objects remain legible in both portrait and landscape views. Pan across wide scenes on smaller screens instead of shrinking the room to fit.
- Placeholder chambers should still read as places: layer carved stone blocks, framed arched gates, columns, recessed alcoves, reliefs and cast shadows. Use restrained light pools for depth; avoid flat abstract slabs, slide-like compositions and permanent rectangular hotspot outlines.
- Treat vector room dressing as replaceable scenery. Keep hit areas and puzzle states independent, and show interaction feedback briefly on hover or press.

## Production principle: backgrounds are not the mechanics

AI-generated backgrounds are appropriate for early concepts and finished art **after approval**. Do **not** rely on generated imagery for mechanically exact puzzle symbols, readable text, numeric markings or precise hit geometry.

Instead:

1. Author a chamber background image as a replaceable scene layer.
2. Keep door frames, moving leaves, doorway reveals and any foreground occlusion in separate layers.
3. Define interactive hotspots and authored object artwork separately in structured data.
4. Render mechanically exact symbols, numbers, puzzle pieces and UI via Phaser/SVG/HTML.
5. Overlay particles, focal highlights and animations as separate controllable layers.
6. Test scaling and hotspot registration on phones and desktops.

`RoomPresentationDefinition.backgroundImage` accepts a public asset path such as
`assets/rooms/entrance.webp`. Doorway art is addressed by stable exit ID; its
visual state moves from `closed` through `opening` to `open`, while progression
remains owned by game state. Placeholder architecture and object layers can be
replaced independently when approved generated art is ready.

Use replaceable placeholders until art is ready. Do not assume a design reference in a previous chat is available as an asset in the repo.

## Motion and sound

- Brief pan/zoom/focus transition when inspecting a mechanism.
- Subtle dust motes and flames; avoid distracting continuous camera movements.
- Door/mechanism animations communicate successful unlocking.
- Atmospheric soundscape and tactile feedback can be added after mechanics work.
- Respect reduced-motion settings where possible.

## Logo (exploratory)

Working wordmark: **ENIGMA**, potentially with the letter **A** treated as a pyramid containing an eye or subtle central symbol. Ancient-stone/gold-on-dark visual language with mysterious glyph touches. This is a direction under discussion, **not a selected production logo**.

## Asset naming and provenance

- Store game-used assets under a clear asset folder; use descriptive filenames and manifests.
- Keep prompt, source generation notes and approval status in an asset index when appropriate.
- Distinguish concept references, approved art, placeholders and final exports.
- Never copy protected art from inspirational games.
- Compress and size assets reasonably; verify load times on mobile.
- Gameplay should still work when art assets are replaced.

## Visual Lab experiment

The main adventure's approved direction remains illustrated realism. A separate
Visual Lab compares Classic and HD pixel-art treatments of one identical
chamber as a visual study, plus an empty illustrated integration slot. This
experiment does not change the main adventure art direction. Its palettes,
compositions, layer boundaries, generator and placeholders are documented in
`docs/VISUAL_LAB.md`; the generated pixel PNGs are exploratory, not final
production assets.

## Immediate art needs

For the vertical slice: one entrance illustration, at least two visually distinct puzzle chambers, a secret alcove concept, a pair of close-up mechanisms, and a simple map style guide. **Code may use placeholders first.** Final art is not a prerequisite for implementing the scene system.
