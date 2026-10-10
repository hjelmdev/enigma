# ENIGMA

ENIGMA is a mysterious, educational first-person point-and-click adventure set in and beneath an ancient Egyptian pyramid. The game opens with the playable prologue (title, attic, the inherited miniature pyramid, travel, the desert pyramid and the _Ögats ljus_ sunlight puzzle); see [docs/story/PROLOGUE_IMPLEMENTATION.md](docs/story/PROLOGUE_IMPLEMENTATION.md). The earlier vertical slice with three linked chambers, prototype puzzles, animated gates and a discovery map remains available under Settings. Room art, names, clues and story text remain replaceable placeholders; they are not final art or story canon.

## Run locally

Install Node.js 22 or newer, then run:

```sh
npm install
npm run dev
```

Useful checks: `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`. Regenerate the prologue pixel art with `npm run generate:prologue-art`.

## Project structure

- `src/game/world/` contains typed, data-driven room and hotspot definitions.
- `src/game/scenes/` contains the title menu and shared chamber interaction.
- `src/game/puzzles/` contains testable puzzle rules separate from their Phaser UI.
- `src/game/state/` tracks visited rooms and solved gates for the current browser session.
- `src/game/ui/` contains the puzzle panels and schematic pyramid map.
- `src/game/presentation/` defines layered room rendering and explicit door visuals.
- `tests/` contains content validation tests.
- `docs/` is the source of truth for design and implementation direction.

Prologue progress is saved locally in IndexedDB; the older chamber slice keeps session-only progress. Durable local saves, approved production art, final story and puzzle designs remain future work. GitHub Pages deployment is configured in `.github/workflows/pages.yml` and builds at `/enigma/`.

## Design documents

- [Agent instructions](AGENTS.md)
- [Game design](docs/GAME_DESIGN.md)
- [Technical design](docs/TECHNICAL_DESIGN.md)
- [Art direction](docs/ART_DIRECTION.md)
- [Roadmap](docs/ROADMAP.md)
