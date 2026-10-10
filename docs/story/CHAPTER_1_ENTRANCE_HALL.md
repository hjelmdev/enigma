# ENIGMA — Chapter 1: Entrance Hall (implementation brief)

**Status:** Approved direction and implementation brief. Specific visual staging, puzzle instances, tuning and copy remain subject to playtesting and creative review. Work on a NEW feature branch from latest `main`. Do not disturb experimental branches or old PRs.

## Core vision

After the prologue's opening gate, a short atmospheric passage leads to a **monumental, explorable central entrance hall**, significantly wider than the viewport. Preserve authored premium HD pixel art, physical depth and layered animation. In portrait/mobile, pan through the SAME world at readable scale; do not compress the panorama to fit.

The hall is an enduring **hub**, with monumental, initially sealed exits. Two **independent, optional-order** first puzzles stand at opposite sides of the hall: a wall sliding-tile relief and a bronze weighing mechanism. Each unlocks its own doorway, not a themed mathematics or geometry zone. Neither repeats the prologue's light/rotation puzzle. Show a satisfying environmental response to success. Do not build destination rooms yet; do not claim unseen passages are playable.

Future rooms may be architecturally impossible, change connections between runs or be absent in some runs; no fixed topic-based sections. Today's version can have fixed connections, but separate **stable room identities** from **run-specific exits/graph**, with visit/visibility state, and do not hardcode future map positions. No need to implement procedural room selection now.

## Interaction pattern

Exploration = large, horizontally pannable hall. Examination = dedicated, immersive, near-fullscreen close-up for each puzzle, with clear back/exit action returning to prior hall camera position. Distinct hand-crafted visual stations, common reusable state/input framework. Support mouse, touch and keyboard where practical. No permanently intrusive overlays in the art. Current hotspot rings may remain for now; future subtle hotspots/help tracking are documented separately in `docs/FUTURE_INTERACTION_IDEAS.md` and are OUT OF SCOPE.

## A. Wall sliding-tile relief

- Mechanically authentic sliding puzzle in a **recessed vertical wall panel with tracks**, near an exit. One empty slot; ONLY adjacent orthogonal tile moves into the empty slot. Make movement feel like heavy carved stone.
- First instance: **3×3** picture puzzle (a carved relief with story significance, e.g. a figure presenting a small pyramid). A legible reference/visual clue is nearby; no arbitrary answer guessing.
- **Fixed move budget** for an attempt. A move is consumed only on a legal slide. Clearly show moves remaining. On exhaustion without success, reset to the configured initial layout and budget; manual reset available. Decide any Undo mechanic deliberately; it must not trivialize the move limit. Success when the actual arrangement matches the intended relief.
- Engine and presentation must be **dimension-independent**, supporting configurable rows/columns (e.g. 3×3, 4×4, 3×4), tiles/art, initial state, goal state, allowed move count, and future puzzle definitions. No 3×3 assumptions in move logic or rendering. Honor accessibility/touch hit targets.
- Generate or verify initial positions via legal moves from a solved state; validate reachability and that **minimum solution distance does not exceed move budget**. Prefer an intentionally crafted, visually satisfying first instance and tested difficulty; do not rely on arbitrary shuffles or assert any shuffle is fair.
- Completion persistently opens one doorway; revisits show solved relief rather than re-triggering unlock.

## B. Balance scale — `Vågens hemlighet`

- Separate fullscreen close-up with ornate two-pan bronze balance, hieroglyph/relief clues visibly above, a shelf with **all physical available weights visible** below, and a dramatic mechanical **lever**.
- Start with only **three clear Egyptian motifs**: **scarab, falcon, lotus**, represented as distinct small sculpted weights and matching simplified relief glyphs. No cats/dogs, and no visibly printed kilogram values.
- One side holds a sealed target object; player freely adds/removes a selection of physical weights on the other. Not all shelf weights must be needed. **Scale remains locked/does not reveal feedback until lever is pulled.** The lever is the single commit action; make it hard to trigger accidentally.
- Reliefs express solvable equivalent-weight relations visually, e.g. 3 lotus = 1 scarab; scarab + lotus = 2 falcons; target = falcon + scarab. This is a MECHANICAL example, not a mandatory final puzzle. Avoid obvious target duplication where players can simply copy the displayed objects; actual first instance should require reasoning while remaining fair for younger players.
- **On a correct weighing**, physically animate equilibrium and unlock the other doorway. Accept **all mathematically valid combinations**, not one hardcoded chosen selection, subject to publicly stated constraints.
- **On an incorrect committed weighing**, animate failure, then generate a **new** puzzle with newly matching carved clues, shelf inventory, target and values. The new puzzle becomes stable through save/load until the next lever pull. Rearranging weights without pulling the lever must NOT reroll.
- Reusable **configurable puzzle generator**: number of symbol types (first 3), available counts, difficulty/relationship depth, clue count, target composition, attempt policy (reroll-on-fail for this first instance; alternatives later), and seed. Generator must construct AND check coherent solvable problems with adequate, intelligible clues, at least one reachable inventory-constrained solution, and no unintended degenerate/trivially obvious solution. Deterministic seeded regeneration; use bounded retry/fallback on invalid candidates. If uniqueness is claimed, verify it; multiple valid arrangements can be perfectly fine.
- Unit tests must verify symbolic equations, all valid combinations, inventory limits, invalid candidate rejection, reroll-on-failure, persistence of generated instance, successful unlock once, and avoiding brute-force feedback without lever.

## C. Living miniature-pyramid map

**The inherited miniature pyramid IS the map**, not merely a switch for a generic map UI. It stays in inventory. In the hall, a central stone/bronze pedestal can thematically resonate with it; do not make solving the two hall puzzles depend on placing/rotating the artifact again.

Introduce a delightful, staged map awakening when the player arrives in the hall and/or completes their first hall puzzle (choose a coherent sequence and make it clear in the handoff). In inventory inspection, allow magnification and a distinct **inner view/cutaway** of the same miniature, in art style consistent with prologue. This view is reusable/accessible from anywhere after unlock.

- Render **only visited/actually discovered rooms and connections**, plus clearly seen, known closed exits if useful. Completely unknown, hidden and run-omitted rooms remain INVISIBLE — not silhouettes or question marks that spoil secrets.
- Current room, traversed pathways, opened doors and solved puzzles need distinct readable states. Treat revealed room connectivity as a graph projected onto an artistic pyramid cutaway, rather than a literal Euclidean floor plan.
- First iteration only requires coherent entrance/passage/hall and any discovered exits, with room identities and graph/state model ready for later dynamic placement. Don't simulate or expose unreached future content.
- As either puzzle is solved, miniature subtly gains a new corresponding mark/connection. As both are solved, a stronger optional visual reaction may occur, without prematurely opening arbitrary third content.
- The map must stay readable and navigable on portrait mobile and desktop. Do not replace the mini-pyramid's existing surface markings/canonical glyph identity.

## Narrative and art safeguards

Maintain continuity with `docs/story/CHAPTER_1_PROLOGUE.md`, existing prologue implementation, symbol sheet, deterministic asset generator, `docs/ART_DIRECTION.md`, and `docs/TECHNICAL_DESIGN.md`. Never regress intro, exterior sun puzzle, inventory, save or entrance reveal. Hall should be grand, authored and lived-in; visually distinct from exterior. Focus on two exceptional interactive close-ups over many incomplete rooms. Write Swedish narrative/UI copy, with accessible concise controls.

## Scope and gates

IN: short corridor; central hall panorama; two independent doors & puzzle close-ups; reusable tile and balance puzzle engines with deterministic tests; mini-pyramid map first meaningful version; persistence; art/animation; desktop verification; implementation notes.

OUT: downstream destination rooms; boss/master rooms; procedural room selection; fixed topic zones; sound production (hooks okay); redesigned hotspot helper; unrelated experiments; revising the title/logo (separate future task).

Quality: test both puzzle success/failure/reset/reload/revisit and any completion order; seed stability, save migration, portable engine APIs, sliding layout sizes 3×3/4×4/3×4, mobile framing/touch targets, cutaway spoiler visibility, scene flow, production build. Acknowledge renderer/mobile test limitations if not actually verified; do not claim WebGL or physical phone verified if untested.

## Agent workflow / Git

Follow up-to-date `CLAUDE.md` and `docs/agents/WORKFLOW.md`. Opus owns creative direction, puzzle quality, cohesive hall art and visual approval; delegate bounded implementation/testing to named Sonnet/Haiku agents before taking over routine scaffolding. Set interfaces and no-overlap file ownership. Brief task map first; report real delegation, checks and known limitations. New `feature/chapter-1-entrance-hall` branch from latest main. Commit and push; PR only when requested; do not merge.
