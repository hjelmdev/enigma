# ENIGMA — Model-aware development workflow

Purpose: keep artistic quality high while minimizing expensive context and preserving a reliable Codex/Luna fallback.

## Routing guide

| Work | Primary | Fallback/escalation |
| --- | --- | --- |
| Novel rooms, puzzle reasoning, art direction, visual approval, complex generator design | Opus lead | Sol or Sonnet after a focused trial |
| Search locations, summarize existing symbols | Haiku `code-explorer` | Direct search if trivial |
| Focused unit/regression tests | Haiku `test-engineer` | Sonnet for tricky integration tests |
| Repetitive typed code, fixtures, mappings, small scoped UI wiring | Haiku `implementation-assistant` | Sonnet for coupled changes |
| Integrate designed systems, bounded multi-file bugs | Sonnet `integration-engineer` | Opus for key architecture/visual problems |
| Continued implementation when Claude is at limit | Codex/Luna with `AGENTS.md` | Sol for difficult bugs, when available |

These are hypotheses to measure, not permanent claims about relative model ability. Keep track of iterations, rework, quality, elapsed time and usage rather than optimizing token price alone.

## Task contract template

**Goal:** one measurable outcome.
**Context:** 1-3 relevant file paths or symbols; no full chat transcript.
**Owned files:** files the subagent may edit. No overlapping ownership in parallel.
**Do not change:** explicit exclusions (e.g. puzzle solution, room art, architecture, unrelated scenes).
**Acceptance criteria:** observable behavior and key edge cases.
**Verification:** exact relevant commands; ask lead if unavailable.
**Return:** up to 10 lines: changed files, findings, tests actually run, risks, blocker if any.

For expensive tasks, the lead should first establish design and interfaces, then delegate independent, bounded work. Avoid using an Opus subagent for routine work by accident: choose named agents and verify which model was invoked. Parallelize only independent tasks; don't spawn agents simply because parallelism is possible.

## Creative/art workflow

1. Lead defines room concept, distinctive puzzle reasoning and visual quality bar.
2. Lead authors one high-quality reference room/asset pipeline with clean layers and deterministic regeneration.
3. Freeze a minimal reusable contract: asset names/dimensions, world anchors, masks, puzzle events, door states, camera behavior.
4. Hand off clearly specified integration, tests and content variations to Haiku/Sonnet/Luna.
5. Lead visually reviews desktop and mobile, puzzle solvability and door animation, iterates only where necessary.

Avoid premature abstractions that erase authored visual quality. More procedurally generated noise is not automatically better pixel art.

## Codex/Luna fallback

`AGENTS.md` is the shared baseline for all coding agents. This workflow file and the current GitHub task specification must be understandable without Claude-specific context. When resuming with Luna, provide branch/commit, goal, owned files, contracts, tests and known limitations. Luna must not assume Claude subagent tools are available; it can implement the same task directly. Prefer handoff via committed Markdown over chat-only instructions.

## First experiment

Trial one focused Haiku exploration, one bounded Haiku test task, and one Sonnet integration task. Track whether delegation saved Opus context *after* accounting for review and rework. Adapt routing accordingly.
