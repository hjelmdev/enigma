# Agent instructions — ENIGMA

You are a coding agent contributing to ENIGMA, a first-person, scene-based Egyptian-pyramid puzzle adventure. Read **README.md** and all files in **docs/** before implementing major features. Treat these committed documents as the project source of truth.

## Your role

Implement the game and its developer tooling incrementally. The human and ChatGPT handle much of the creative direction and puzzle specification; do not silently substitute major gameplay or narrative choices. When requirements are incomplete, choose a reversible, minimal assumption and call it out.

## Technology and constraints

- Use **TypeScript, Phaser, Vite**; target a static GitHub Pages deployment.
- Favor simple, maintainable modules and data-driven scene/puzzle definitions. Avoid a large framework or backend without approval.
- Prioritize desktop browser **and** mobile touch; mobile landscape is the starting target, not an excuse for inaccessible controls or cropped interfaces.
- HTML/CSS/SVG overlays are acceptable when better than Phaser for UI or puzzle widgets.
- The MVP is single-player, offline/local-first, with save data in IndexedDB. Design for potential future migration; do not build auth, a server, analytics, multiplayer or monetization now.
- Generated concept art may not exist yet. Use clearly labeled placeholder assets and clean asset boundaries rather than blocking development.

## Gameplay invariants

- Scene-based first-person exploration, not a freely walking avatar.
- Each meaningful progression gate should be a distinctive puzzle with an explicit, testable solution.
- Solve once, keep the exit open. Persist puzzle state, discovered rooms, explored connections and secrets.
- Support deliberate backtracking without replaying solved locks.
- Concealed rooms must not appear on the player-facing map until discovered.
- Avoid timers, combat, player death, fail traps and opaque pixel hunting.
- Hints should guide reasoning in stages, not instantly reveal answers.
- Avoid repetitive re-skins of the same puzzle. Difficulty variants may change structure or parameters **while preserving deliberate solvability**.

## Architecture preferences

- Separate the **content model** (rooms, exits, puzzles, clues, secrets) from presentation and the game state.
- Favor small typed interfaces with stable IDs; make persistence serializable and versioned.
- Puzzle modules must expose initialization, validation, completion, reset/retry where appropriate, and state serialization.
- Implement transitions and close-up focus interactions centrally, not once per room.
- Make the cutaway map depend on discovered state, not a hard-coded always-visible floor plan.
- Provide keyboard support and sensible touch hit areas; keep text and puzzle symbols legible.
- Guard against stale saves and invalid puzzle parameters.

## Workflow

1. Inspect the existing repository and documentation before editing.
2. State the smallest coherent implementation plan.
3. Implement a vertical slice with tests on puzzle logic and save/load.
4. Run available formatting, typecheck, tests and build; fix failures.
5. Update documentation when architecture or accepted game behavior changes.
6. Report changed files, verification results, and remaining limitations.
7. Do not claim an asset, level, integration or feature is complete unless it was actually created and verified.

## First implementation target

Follow **docs/ROADMAP.md**. Build the application skeleton, a small linked room network, two **genuinely different** functioning puzzles, focus/zoom interaction, one optional discoverable secret, local saves, and a progressively revealed map. Use placeholder art until approved assets exist.

## Git and agent collaboration

Use focused commits and understandable messages. Do not overwrite design decisions with unreviewed ideas. Content proposals should be documented as proposals, not shipped as final canon without approval. It is fine to propose options or ask for a decision when a substantial unknown blocks work.
