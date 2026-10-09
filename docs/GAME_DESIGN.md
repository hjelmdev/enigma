# ENIGMA — Game design document

**Status:** working specification for the first vertical slice. Specific story beats, chamber names and final puzzle designs remain open until reviewed.

## High concept

Enter an ancient pyramid with no visible avatar and no action combat. Investigate richly illustrated chambers, discover clues and unlock exits through tactile, meaningful puzzles. The adventure gradually reveals a greater archaeological mystery, valuable optional secrets, and a much larger subterranean structure than the entrance suggests.

**Inspirations:** the sense of discovery and educational puzzles in *Cheops Pyramid* / *Chefrens Pyramid*, plus the point-and-click exploration and room inspection associated with *Shadowgate*. Draw inspiration from their principles, not copyrighted visual assets, rooms or puzzles verbatim.

## Audience and feel

- A curious child of approximately **8** should be able to engage with support, while an approximately **12-year-old** should still be challenged.
- Appealing to adults is welcome; it must not look or feel like a school worksheet.
- Mood: mysterious, ancient, intriguing, cinematic and rewarding; suspense without punishment.
- No survival timers, reflex checks, combat or forced speed. Losing a puzzle attempt never means losing the run.

## Core loop

1. Enter a chamber and inspect the scene.
2. Notice exits, clues, unusual objects and possible secrets.
3. Select a hotspot to **focus/zoom** into a close-up or a puzzle.
4. Experiment, reason and optionally request incremental hints.
5. Solve a puzzle to unlock an exit or reveal a clue/secret.
6. Update the cross-section map and move onward — or revisit old areas.

## World and navigation

- Connected graph of rooms and passages, with gates assigned to selected connections.
- **Puzzle-rich progression:** almost every new route should require understanding or applying something; some rooms offer multiple independently locked exits.
- Unlocks are permanent. Navigation back along an opened passage is free.
- Puzzle placement is not restricted to door faces; mechanisms may be in a room or depend on clues discovered elsewhere.
- Limited optional inventory for collected artifacts and hidden finds, not an inventory-combination adventure.
- Optional discovery should feel meaningful but **must not prevent** completing the main story.
- Environmental clues should be visible and interpretable, not arbitrary invisible hotspots.

## The interactive pyramid cutaway map

The cutaway map is a signature experience, not a generic flat minimap.

- Display the pyramid as a cross-section including known chambers, connections, floors and eventually hidden subterranean levels.
- Reveal **only explored/discovered** chambers and passages. Preserve surprises.
- Support tapping a chamber to see its name/status; indicate exits unlocked and unexplored opportunities without disclosing hidden content.
- Potential state examples: visited, room revisitable, 1/3 known exits unlocked, unsolved puzzle, discovered optional secret.
- Include pan and zoom on smaller screens. Map is accessible during exploration and optionally appears in brief travel transitions.
- Treat floor-plan geometry as authored data. A conceptual prototype with simple polygons/rectangles is acceptable before final art.

## Puzzle design principles

**Unique ideas over repeated tests.** Avoid a chain of interchangeable number locks. Each featured puzzle should introduce a distinct interaction and insight. The player should learn by doing, with clues in the world.

Candidate families, not all required in the first release:

| Family | Example interaction | Learning angle |
| --- | --- | --- |
| Logic/ordering | Tower of Hanoi style object transfer | Planning, constraints, recursion intuition |
| Measurement | Balance weights or jug volumes | Arithmetic, equivalence, conservation |
| Pattern discovery | Spatial/number sequences embedded in hieroglyphs | Pattern recognition, deduction |
| Geometry | Rotate mirrors or align reflected beams | Angles, spatial thinking |
| Codes | Decode clues from found symbols | Logic, substitution and inference |
| Visual programming | Guide a scarab through a maze with commands, loops and conditions | Algorithms and debugging |
| Fractions/ratios | Reconstruct a mechanism with proportional pieces | Fractions, comparison |

Puzzles must be **solvable by design**. Parameterized difficulty needs bounded generators or authored parameter sets with solution validation. Do not randomize arbitrary numbers and hope a solution exists.

### Difficulty and accessibility

- Initial choice could be *Explorer* and *Thinker* (working labels; final naming TBD).
- Prefer structural adjustment (number of pieces, constraints, available clues, board complexity) to simple numerical inflation.
- All variations must preserve the same essential concept and a comparable sense of achievement.
- Progressive hint ladder: **observe** → **reason** → **next step**, with the last stage explicit only if requested.
- No dependence on high reading speed or prior school terminology; short contextual explanations can be embedded in the environment.
- Input should support touch, mouse and ideally keyboard; keep pieces and symbols sufficiently large.

## Example vertical slice — provisional, not final story canon

A deliberately small connected space demonstrates systems before producing the full pyramid:

1. **Entrance chamber:** establish interaction language, two visible routes, an environmental hint and the map.
2. **Balance chamber:** a tactile weight/logic puzzle opens the next route.
3. **Hall of reflections:** a mirror/geometry puzzle uses a different interaction model.
4. **Side alcove / concealed niche:** optional secret discovered by observation, not required for the route.

These are *implementation placeholders*. Replace names, layout and mechanisms when the creative designs are approved. The two puzzles must not merely be numerical variations.

## Narrative outline (open)

A layered mystery: why the pyramid's architecture disagrees with its apparent history, what its hidden chambers protect, and why some passages lie below the known structure. Communicate story primarily through spaces, artifacts and environmental discoveries. Do not commit to a final twist until the plot is designed.

## Explicit non-goals for MVP

- School dashboards, class accounts or curriculum reporting.
- Multiplayer, timed leaderboard, combat or platformer movement.
- Massive inventory, item-combination chains or procedural full pyramids.
- Backend, account login, synced saves or microtransactions.
- Dozens of rooms before a robust and enjoyable vertical slice.

## Open design decisions

- Final story, ending, room names and world layout.
- Puzzle selections and exact mechanics for the first playable release.
- Difficulty-mode labels and whether mode may be switched mid-game.
- How to communicate potentially remaining secrets without spoilers.
- Localized language and voice/audio scope.
