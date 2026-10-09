# ENIGMA

**ENIGMA** is a mysterious, educational first-person point-and-click adventure set in and beneath an ancient Egyptian pyramid.

The player explores atmospheric illustrated chambers, studies clues, and solves distinct logic, mathematics, and visual-programming puzzles to uncover routes and secrets. The ambition is to capture the curiosity and discovery of classic educational adventures without turning the game into repetitive quizzes.

> **Status:** pre-production / technical vertical slice. The repository contains design documents first; game implementation has not yet been scaffolded.

## Design pillars

1. **Every chamber is worth exploring.** Discover hidden passages, details, artifacts, and a mystery that unfolds through the environment.
2. **Knowledge opens doors.** Most progression gates are actual puzzles. Each meaningful puzzle idea should be distinct rather than the same mechanism with altered numbers.
3. **Accessible, never trivial.** A child aged around 8 and a child aged around 12 should both find a worthwhile challenge through thoughtful difficulty settings and reasoning-based hints.
4. **No pressure.** No combat, timed survival, or punitive fail states. Backtracking and experimentation are welcome.
5. **The pyramid is a character.** A progressively discovered interactive cutaway map shows the explored structure, including surprising underground areas.

## Experience

- First-person fixed viewpoints: room art with tappable hotspots; no movable on-screen avatar.
- Cinematic but lightweight transitions; inspecting an object can zoom into a dedicated interactive puzzle view.
- Exits unlocked by solving puzzles stay unlocked; revisit rooms freely.
- Optional treasures and secret chambers complement the main route rather than blocking the ending.
- Minimal inventory, primarily for discoveries; avoid obscure item-combination puzzles.
- Web-first with desktop mouse and mobile touch, favoring landscape on mobile.

## Intended technology

- **Phaser + TypeScript + Vite** for scenes, interaction, camera effects, state and game runtime.
- HTML/CSS/SVG where they make puzzle interfaces, settings or responsive accessibility better.
- Static deployment to **GitHub Pages**, built through GitHub Actions.
- Save locally using **IndexedDB** (with a defined save schema); no backend, account system, or cross-device sync in the MVP.

These are initial technical decisions, not a claim that code exists yet.

## Project documentation

- [AGENTS.md](AGENTS.md) — implementation guidance for Codex/Luna.
- [Game design](docs/GAME_DESIGN.md) — vision, exploration, puzzle rules, progression and difficulty.
- [Technical design](docs/TECHNICAL_DESIGN.md) — architecture and data model proposal.
- [Art direction](docs/ART_DIRECTION.md) — visual references and asset production principles.
- [Roadmap](docs/ROADMAP.md) — implementation phases and acceptance criteria.

## Collaboration

ChatGPT is used for brainstorming, game design, puzzle specifications, and asset concepts; Codex/Luna implements code and tests. **This repository is the source of truth.** Capture accepted decisions in documentation instead of assuming a coding agent can read a conversation.

The next milestone is a small, *playable* vertical slice, not a fully authored pyramid. See the roadmap.
