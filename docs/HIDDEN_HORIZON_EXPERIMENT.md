# The Hidden Horizon — Sol chamber experiment

Status: independent art and interaction experiment; names, architecture, story
and puzzle are proposals, not approved ENIGMA canon. One room, one mechanism,
one gate. Existing adventures and experiments retain their entry points.

## Play

Run `npm run dev`, then choose **SOL · DOLDA HORISONTEN →** in the menu, or
open `/?experiment=hidden-horizon`. On GitHub Pages use
`/enigma/?experiment=hidden-horizon` after this branch is merged/deployed.

- Drag the room horizontally, or use the arrow keys. The camera fills the
  screen without stretching the room; portrait shows a crop of the same world.
- Tap the wall relief, bronze mechanism or basalt gate. Fixed buttons also
  bring each object into view and open its inspection. Keyboard: 1 for relief,
  2 for mechanism, Tab/Enter for controls, Escape to return.
- Inspect the relief, then move the three bronze stars in the dedicated
  close-up. The up/down buttons are at least 44 px high. Closing the view keeps
  the arrangement. The relief can be recalled while working on the mechanism.
- **Pröva himlen** checks the alignment. Incorrect attempts have no penalty.
  **En ledtråd** advances through three hints without automatically solving.
- The top-bar restart affects only this experiment. Meny returns to ENIGMA.

Developer solution: vass/reeds **2**, falk/falcon **4**, båt/boat **1** steps
above the turquoise horizon. Starting arrangement: `[0, 1, 3]`. The matching
emblems and five carved notches make the relation explicit; the player counts
heights rather than guessing a combination. All 125 states are legal and can
reach the unique target through bounded single-step moves.

## Reference and independence

GitHub fetch failed in the execution environment, but a local checkout contained
the requested Gravity Run branch. The reference was inspected read-only at
`claude/analys-och-forbattringar`, commit
`b67a39f8b519425837204817ad260cddb9cc15f2`. Its files are nested beneath
`gravity-run/`: `biomes/biome_renderer.gd`, `biomes/pixel_palette.gd`,
`hazards/pixel_hazard_art.gd`, `collectibles/pixel_coin.gd`, `ui/pixel_ui.gd`,
`tools/pixel_tiles/generate_biome_tiles.gd`,
`tools/campaign/generate_world_maps.gd` and `docs/PIXEL_BIOMES.md`.

Conceptual takeaways: semantic palettes consumed by reusable generators;
cached raster layers with nearest filtering; deterministic surface detail;
art sizes independent of hit geometry; presentation independent of rules;
inspection/export beside generation. No Gravity Run code, assets or style were
copied, and that repository was not modified. ENIGMA documentation and generic
bootstrap/menu code were read for integration. Existing experiment generators,
scenes, layouts and assets were not used to design this chamber.

## Art and palette

`src/experiments/hidden-horizon/art/` contains the complete authored generator.
There are no downloaded, ImageGen or externally supplied assets. The 800×450
RGBA room is generated on entry and registered as cached Phaser textures.
Every static pixel is reproducible; ambient flame/dust and door dust animate
separately. Exported PNGs are review outputs, not game dependencies.

The asymmetric hypostyle chamber places a shallow offering pool on the left,
a bronze/faience star table near the centre and a monumental gate on the right.
Foreground columns, cast shadows, a foreshortened floor and diminishing masonry
establish depth. Wall/floor stone courses are computed in plane coordinates
from perspective ray intersections; chips and strata follow the courses.
Capitals, feathers, emblems, carvings and damage are authored pixel clusters.
A faint ventilation beam and live brazier give separate lighting accents.

`palette.ts` defines eight-step material ramps. Limestone moves from slate
shadows to ivory; sandstone supplies warmer architecture; basalt reserves the
darkest values for the gate and recesses. Bronze is selectively highlighted,
faience provides turquoise accents, ochre differentiates fired clay, and water
has its own cool ramp. Narrow ordered transitions keep value changes readable
without applying random speckle to every surface. The UI uses a related palette
but keeps text and controls separate from the raster art.

## Gate sequence and occlusion

Back to front: passage → moving basalt slab → static chamber masonry → opening
light spill → atmosphere/props → activation glow → dust. The chamber raster
has an exact transparent 128×218 aperture. Every pixel around it is opaque:
the slab disappears behind the lintel, and its bottom remains behind the sill.
The reveal is a descending stair with a distant turquoise light.

On successful activation the controls lock and pulse, then the close-up returns
to the room and the camera frames the gate. Dust falls from the lintel. A small
initial lift takes up the load, pauses, then a 4.8-second eased haul raises the
slab. The floor spill brightens as the aperture grows. A final shake and dust
burst communicate the stop. Reduced-motion mode removes shake and ambient
motes, reduces dust and shortens the haul. The open state survives reloads;
the animation is not replayed on return.

## State and module boundaries

- `model.ts`: initialization, bounded moves, target validation, activation,
  versioned restoration and JSON serialization. Solved mechanisms are immutable.
- `persistence.ts`: isolated IndexedDB database `enigma-hidden-horizon` and
  a validated schema. Invalid/stale data falls back to a fresh puzzle. Storage
  errors keep progress in memory and display a message when saving fails.
- `ui.ts` / `horizon.css`: screen-fixed controls and responsive close-ups,
  named buttons, focus trapping, live feedback and staged hints.
- `HorizonScene.ts`: camera/gesture handling, scene lifecycle and door visuals.
  A 14 px drag threshold suppresses hotspot activation after movement. Phaser's
  centre-based zoom bounds are used for every pan and inspection transition.
- `tests/hiddenHorizon.test.ts`: all-state solvability, invalid moves, one-way
  completion, save round trips, corrupt saves and deterministic layer/occlusion
  checks.

## Regenerate and verify

The game always uses the generator source: edit it and reload to regenerate.
For exported PNGs and browser QA, run the dev server and then:

```sh
# Optional tooling dependency, not a game dependency:
npm install --no-save playwright
npx playwright install chromium
npm run verify:hidden-horizon
```

Alternatively set `HORIZON_NODE_MODULES` to an existing package directory and
`HORIZON_BROWSER` to an installed Chromium/Edge executable. `HORIZON_URL` can
select another Vite dev-server URL. Set `HORIZON_VIDEO=1` if Playwright's ffmpeg
is installed to record the desktop run. The script exports every generated
layer, room/clue/puzzle/open screenshots and three intermediate opening frames
to the git-ignored `artifacts/hidden-horizon/`, plus `verification.json`.

The browser harness checks desktop 1440×900, portrait 390×844 and 320×568,
and landscape 844×390 and 667×375: no document overflow; visible touch controls;
partial and solved IndexedDB reloads; close/reopen; incorrect attempts;
completion; reset; drag suppression; Escape and menu return. Inspect the PNGs
to assess composition, materials and layer overlap; passing logic tests alone
does not establish visual quality.

Manual device checks still recommended: drag to both room edges; tap objects
after panning; rotate with the puzzle open; revisit after refresh; enable reduced
motion; inspect the slow lift, threshold and final stop. Browser emulation does
not replace testing physical iOS/Android devices.

Verified on 2026-10-10: all 31 Vitest tests passed; TypeScript, ESLint and the
GitHub Pages production build passed. The five-size Chromium/Edge harness
passed, including emulated touch gestures, clue recall, hints, save/reload and
reset. Room, relief, close-up, intermediate lift and open-state screenshots
were visually inspected in desktop and both phone orientations. A production
preview at `/enigma/` passed the new menu entry, puzzle inspection, menu return,
adventure start and experiment deep-link smoke checks without runtime errors.
Changed files pass Prettier. Repository-wide formatting reports pre-existing
warnings in `.claude/launch.json`, `CHATGPT-WRITE-TEST.md` and
`docs/GAME_DESIGN.md`; those unrelated files were left untouched. Vite also
reports the existing large single application bundle warning.

## Limits

No sound, no subsequent playable room and no final production art or historical
claim. Copy is provisional Swedish. Fractional nearest-neighbour scaling can
produce uneven pixel widths on some displays. The experiment is local-first;
IndexedDB availability and eviction remain browser-dependent. External Google
Fonts in the existing shared stylesheet are optional; this experiment uses
system fonts/Georgia and requires no font fetch to play.
