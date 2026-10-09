# ENIGMA — Roadmap

**Status:** milestone plan. Prioritize a delightful playable slice over quantity of content.

## Phase 0 — Repository and shared specification

**Goal:** establish the single source of truth for ChatGPT design and Codex implementation.

- [x] Create design, architecture, art and agent guidance documents.
- [ ] Review open decisions with the project owner.
- [ ] Bootstrap repository conventions and a development workflow.

**Done when:** an agent can explain the game and start implementation without depending on chat history.

## Phase 1 — Playable technical skeleton

- [ ] Scaffold Phaser + TypeScript + Vite with scripts for dev, test, typecheck, build.
- [ ] Configure GitHub Pages build/deployment using the correct base path.
- [ ] Display a placeholder exploration chamber at desktop and mobile landscape sizes.
- [ ] Implement taps/clicks on authored hotspots.
- [ ] Implement inspect/zoom/focus transition to a close-up and back.
- [ ] Implement data-driven room definitions and graph navigation.
- [ ] Handle safe scaling of hotspots and basic accessible controls.

**Done when:** the user can explore and inspect a small prototype in a browser and on mobile.

## Phase 2 — Two genuinely different puzzles

- [ ] Build **two functional puzzle interaction types**, not two variants of one numerical lock.
- [ ] Keep puzzle logic separate from visual rendering.
- [ ] Define victory, reset, hint steps, success feedback and gate unlock.
- [ ] Ensure solved gates stay open when revisiting.
- [ ] Test puzzle correctness and representative difficulty variations.

**Candidate placeholders:** balance weights/logic and mirrors/geometry. Final mechanics need design approval.

**Done when:** a player can solve two distinct puzzles and progress through a short route.

## Phase 3 — Discovery, secrets and persistence

- [ ] Add one optional, discoverable secret area or artifact.
- [ ] Persist visited rooms, revealed connections, unlocked gates and solved puzzles.
- [ ] Implement robust IndexedDB save/load with versioning.
- [ ] Implement cutaway pyramid map that grows only as locations are discovered.
- [ ] Show meaningful known-room/exit status and support map pan/zoom.
- [ ] Confirm restart/refresh/backtracking never resets legitimate progress.

**Done when:** exploration, permanent unlocks, secrets and map discovery work across reloads.

## Phase 4 — Polish and user testing

- [ ] Replace selected placeholders with approved illustrated assets.
- [ ] Improve visual focus transitions, door feedback and restrained atmosphere.
- [ ] Add progressive contextual hint UX and difficulty profiles.
- [ ] Test on representative phones, tablets and desktop browsers.
- [ ] Fix hotspot precision, unreadable UI, bad save cases and major performance issues.
- [ ] Conduct playtesting with younger and older players; refine frustration points.

**Done when:** the slice feels like a small real adventure rather than a tech demo.

## Phase 5 — Expand the pyramid

**Only after the slice is proven enjoyable.**

- [ ] Outline the full mystery and major narrative reveals.
- [ ] Author an interconnected multi-level pyramid with optional routes.
- [ ] Design a varied puzzle library with no filler re-skins.
- [ ] Create approved art and audio pipeline.
- [ ] Plan release scope based on playtest feedback.

## Definition of done for each feature

- It is actually implemented and usable.
- Input works on both pointer and touch, where relevant.
- It preserves progression and does not expose undiscovered secrets.
- Logic is tested and the production build succeeds.
- Documentation reflects meaningful changes.

## Near-term priority for Codex/Luna

**Start with Phase 1.** Present a concise implementation plan, scaffold the project, and get the first room/hotspot/close-up interaction functioning before trying to author a complete game or elaborate lore. Ask before turning provisional example puzzles or room names into final canon.
