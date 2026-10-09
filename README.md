# ENIGMA

ENIGMA is a mysterious, educational first-person point-and-click adventure set in and beneath an ancient Egyptian pyramid. This repository currently contains the Phase 1 technical prototype: a placeholder chamber with inspectable hotspots and a close-up interaction.

## Run locally

Install Node.js 22 or newer, then run:

```sh
npm install
npm run dev
```

Useful checks: `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`.

## Project structure

- `src/game/world/` contains typed, data-driven room and hotspot definitions.
- `src/game/scenes/` contains the title menu and shared chamber interaction.
- `tests/` contains content validation tests.
- `docs/` is the source of truth for design and implementation direction.

The prototype uses drawn placeholder scenery. Puzzle systems, the pyramid map and persistence are reserved for later roadmap phases. GitHub Pages deployment is configured in `.github/workflows/pages.yml` and builds at `/enigma/`.

## Design documents

- [Agent instructions](AGENTS.md)
- [Game design](docs/GAME_DESIGN.md)
- [Technical design](docs/TECHNICAL_DESIGN.md)
- [Art direction](docs/ART_DIRECTION.md)
- [Roadmap](docs/ROADMAP.md)
