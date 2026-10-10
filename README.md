# ENIGMA

ENIGMA is a mysterious, educational first-person point-and-click adventure set in and beneath an ancient Egyptian pyramid. The repository contains a small playable vertical slice with three linked chambers, three prototype puzzles, animated gates and a discovery map. Room art, names, clues and story text remain replaceable placeholders; they are not final art or story canon.

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
- `src/game/puzzles/` contains testable puzzle rules separate from their Phaser UI.
- `src/game/state/` tracks visited rooms and solved gates for the current browser session.
- `src/game/ui/` contains the puzzle panels and schematic pyramid map.
- `src/game/presentation/` defines layered room rendering and explicit door visuals.
- `src/experiments/sealed-sun/` is a self-contained room-art experiment with its own generators, puzzle and scenes.
- `tests/` contains content validation tests.
- `docs/` is the source of truth for design and implementation direction.

Progress stays while the current page session remains open and resets after a reload. Durable local saves, approved production art, final story and puzzle designs remain future work. GitHub Pages deployment is configured in `.github/workflows/pages.yml` and builds at `/enigma/`.

## Design documents

- [Agent instructions](AGENTS.md)
- [Game design](docs/GAME_DESIGN.md)
- [Technical design](docs/TECHNICAL_DESIGN.md)
- [Art direction](docs/ART_DIRECTION.md)
- [Roadmap](docs/ROADMAP.md)
- [Sealed Sun experiment](docs/SEALED_SUN_EXPERIMENT.md): a separate, clean-room pixel-art chamber (menu: Experiment · Solkammaren, or `/?experiment=sealed-sun`)
