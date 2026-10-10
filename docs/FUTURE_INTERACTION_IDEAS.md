# ENIGMA — Future interaction and assistance ideas

**Status:** Future plan / design proposal only. **Do not implement during the current prologue task.** Preserve existing behavior until this is scheduled.

## Immersive hotspot discovery

The current always-visible circular hotspot markers are useful for development and playtesting, but should not necessarily be the default presentation in the finished game.

Proposed experience:
- **Default:** no permanent hotspot circles in the world. Keep the scene visually immersive.
- **Desktop hover/proximity:** as the cursor approaches a discoverable object, gently reveal a contextual edge glow, small themed focus mark or subtle highlight. Avoid large persistent target circles.
- **Touch/mobile:** no hover assumed; retain forgiving hit areas. Use context-sensitive first-touch feedback or another discoverable, low-friction interaction, without forcing a tedious double tap on every object.
- **Optional assistance:** a clearly recognizable “show interactable objects” / discovery-help action temporarily highlights available hotspots and then fades. Can be activated deliberately whenever needed, rather than requiring the player to get stuck.
- **Accessibility:** offer adjustable assistance or persistently visible interactive targets when requested; never penalize accessibility settings.

## Help-used tracking

If the player activates the discovery-help action, store a durable per-run `assistanceUsed` flag (possibly with `assistanceTypes` / usage counts in later versions). The player should be told clearly when a choice affects their run statistics, but never shamed or blocked for using help.

Potential later uses: optional end-of-run statistics, achievements, or distinct “completed without discovery help” recognition. **Do not reduce progress, lock content, punish players, or imply a lesser canonical ending.** Decide later whether other hint tiers should share this flag or have separate tracking.

Track this as part of versioned save/progression state, not just a temporary UI flag, once implemented. Decide separately whether reset/new game clears it and how optional chapters are counted.

## Design principles / future acceptance criteria

1. Scene art is free of always-on debug-looking circles by default.
2. Desktop mouse nearness produces discreet feedback without distracting shimmer everywhere.
3. Mobile interactables remain easy to locate and tap, even without hover.
4. Assistance reveal is optional, obvious, brief, legible and reversible.
5. Activating assistance reliably records the run as assisted, survives save/load and is visible in future statistics if those are added.
6. Accessibility options are not treated as “cheating.”
7. Keep a debug overlay for testing hotspot positions.

**Implementation priority:** Later polish pass, after the prologue and first playable interior hall have been assessed. This document is not an instruction to alter the current implementation.
