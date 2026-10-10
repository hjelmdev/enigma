# ENIGMA — Prologue: The Inherited Pyramid
**Status:** approved creative direction / implementation proposal; Chapter 1 interior remains to be designed  
**Scope:** title screen, short cinematic prologue, inspectable artifact, travel montage, first outdoor light puzzle, hidden entrance  
**Audience:** curious players ~8–12 and adults  
**Language:** Swedish player-facing text; English developer documentation

## Core premise
The player inherits a small, astonishingly precise dark-stone pyramid from their late grandfather. Its proportions and recurring markings resemble a remote, mysterious Egyptian pyramid. A short handwritten note suggests that light and an eye reveal a hidden path. The player travels there to investigate and uses the miniature to redirect sunlight onto an eye-shaped relief on the full-sized pyramid, opening a concealed entrance.

This is an adventurous mystery, not horror. Do not explain the miniature's construction or ultimate purpose yet. It remains a persistent story object with legible, consistent engravings that can matter in later rooms. **ENIGMA is the game's title, not necessarily the pyramid's in-universe name.** Leave the ancient pyramid's name undecided.

## Creative pillars
- Show, then invite interaction. Short atmospheric captions, cinematic compositions, environmental details; no long exposition.
- Use deliberate, premium HD pixel art with coherent materials, strong depth, cool shadows versus warm light, sandstone, lapis/turquoise and bronze/gold accents where appropriate. No generic flat programmer art or random texture noise.
- An intentional first-person camera with large explorable scenes, **not the cramped, zoomed-in 960px-style showcase chambers**. World composition is independent of viewport. On portrait mobile show a narrower, same-scale window and pan/tap to investigate; never squash an entire panorama to fit.
- The prologue's cinematic stills can use parallax and modest animation; reserve rich direct interaction for inspecting the miniature and the sunlight puzzle.
- A clear first triumph within minutes. Opening the entrance teaches observation -> inspect -> manipulate -> consequence.

## Opening flow
1. Title screen -> New Game / Continue / Settings (Continue disabled if no save). ENIGMA logo; atmospheric pyramid silhouette in changing dawn light, drifting dust, restrained audio-ready ambiance. Responsive touch UI. Optional skip intro after first viewing.
2. Attic / box: A wooden heirloom box among grandfather's belongings. Text and image establish inheritance.
3. Artifact inspection: Lift and turn miniature pyramid. Several distinct carved faces; geometry uncannily exact. Inspect via drag/swipe or accessible left/right controls. Keep the same engraved symbol layout on all later uses.
4. Grandfather's note: Show a tactile handwritten note plus readable text overlay. Motivate the trip and foreshadow the Eye of Light without revealing exact操作.
5. Travel montage: A brief map/airplane silhouette and crossing the desert (perhaps distant vehicle) — purposeful cinematic transition, not a travel minigame.
6. Monumental pyramid exterior: A **wide panorama** with dunes, pyramid façade, scale, depth, ruins/stonework and environmental eye relief. Let player look around. Camera initially frames the monumental pyramid, not a tight crop of its lock. The artifact is accessible.
7. First playable puzzle — *Ögats ljus* (“The Eye of Light”): Align the miniature to catch sunlight and redirect a coherent beam onto the carved eye. Optional spectral fringes signal refraction without requiring a multi-color combination.
8. Entrance revelation: Eye illuminates, ancient stonework trembles, sand/dust falls, a believable entrance shifts aside/recedes, dark passage reveals contrasting interior lighting. End in a playable transition to the future Chapter 1 entrance hall.

## Draft player-facing narration (editable for pacing)
Keep each caption brief, readable on mobile, and never block the art unnecessarily.

**Attic / box:** “Längst in på farfars vind stod en låda som ingen hade öppnat på många år.”
**Miniature:** “I den låg en liten pyramid av mörk sten. Ytan var slät. Vinklarna nästan omöjligt exakta.”
**Note (handwriting, also accessible transcription):**
> “Jag har letat efter dess like hela mitt liv.
> Sök platsen där de gamla tecknen återkommer.
> När ljuset finner ögat öppnas vägen.”
**Travel:** “Tecknen ledde långt bort — till en pyramid som nästan försvunnit ur historien.”
**Arrival:** “Här fanns samma mönster, inhuggna i sten som inte rörts på århundraden.”
**First interaction hint:** “Farfars sista rad dröjer sig kvar: *När ljuset finner ögat …*”
**Entrance opened:** “Ett dovt ljud skär genom tystnaden. Stenen rör sig. Bakom den väntar mörkret.”

Tone: atmospheric, curious, a little wonder. Adjust language naturally in implementation; avoid claiming a specific historical pyramid is real.

## Artifact design contract
- Miniature is roughly palm-sized (~10–15 cm), dense dark basalt-like material, geometrically perfect, four carved sides and an inscribed underside.
- Engravings must be **stable recognizable motifs** across attic inspection, outdoor puzzle and future inventory/inspection. Define one canonical symbol sheet / art source, not unrelated per-scene images.
- Do not decode all motifs now; the eye and light relationship should be discoverable without reading a manual.
- No overt science-fiction explanation and no magical floating-object effect. Its light behavior is mysterious but visually plausible: small polished seam/inlay or internal optical channel catches sunlight and projects a narrow bright ray with subtle spectrum edges.
- Keep the artifact in inventory after entrance opens. It is not consumed as a key.
- Future possibilities (NOT implement now): miniature as cutaway map trigger or key to mechanisms, moonlight-operated alternate entrance/secret path, hidden subterranean levels. Do not promise hard mode or build a moon puzzle yet.

## First puzzle — Ögats ljus
### Intended reasoning
Player observes: (a) grandfather's note associates light with an eye; (b) the exterior has a carved eye and patterned area; (c) miniature has a seam/mark that catches direct sunlight. Experimenting with orientation causes visible light, ultimately targeting the eye. This is a **beginner puzzle**, not abstract random brute force.

### Interaction / UX
- A discoverable view for holding up/inspecting the miniature, with the pyramid and carved eye visible in context. Drag to rotate/tilt the miniature (or a clear two-axis equivalent). Include accessible touch-sized alternative controls.
- Start with a readable ray hitting near, not precisely on, the target once the player explores alignment. The visual connection must be obvious.
- When close: seam gleams, beam intensifies, target catches a reflection; when correct: deliberate activation and a locked solved state.
- No fiddly pixel-perfect positioning. Broad tolerance with feedback and optional gentle snap on success; prevent random accidental completion on load.
- Optional hints after inactivity or user request: (1) notice the eye, (2) try sunlight on the miniature, (3) steer the beam toward the eye. Do not reveal all at once.
- Respect pointer-drags versus camera pans: interaction mode makes it clear whether the player is rotating the object or moving the view. Stable controls on portrait mobile.
- Keyboard/touch accessibility: visibly labeled controls, no reliance on color alone.

### Behavior and state
- Puzzle has inspect / manipulating / solved states. Solved persists, entry stays open; revisiting does not require solving again.
- Opening animation plays once on first completion, can be replayed via debug/review mode if useful.
- Player can skip/revisit cinematic captions; do not skip essential clues permanently.
- Future interior scene may be a simple labeled transition if Chapter 1 art isn't approved yet; do not fabricate a complete interior level.

## Cinematic entrance reveal
Actual layer-separated animation; no independent AI-generated “door frames” that change proportions. Keep door, wall, opening, passage, foreground stone and dust layers aligned in a shared coordinate system. Plausible stone geometry and occlusion; heavy motion/easing, sound-ready beats, sand and dust spawned from contact points, subtle camera reaction, new darkness/cool air revealed. No floating door leaves, misaligned frame or foreground overlap.

## Large-scene / camera rules (non-negotiable)
- The outside pyramid needs substantial environment visible beyond the central mechanism; don't design exclusively for a single full-screen postcard or scale the entire scene to fit portrait.
- Author a landscape panorama wider than the nominal viewport, with meaningful left/right sights and interactive anchors (ruins, eye relief, stance/location for the miniature).
- Camera bounds preserve artwork scale and pan intentionally with touch drag. Provide a subtle onboarding nudge and recenter option. Test portrait and desktop.
- Different scenes may have different dimensions. Small inspection close-ups are permitted; **world-view size must be dictated by exploration design**, not the earlier art experiment.
- Mobile captions/buttons must not obstruct puzzle target or draggable artifact.

## Main adventure and pyramid map — future Chapter 1 handoff
The first indoor hall will be larger and more explorable than the tech demos, with one approachable *different* internal puzzle and a substantial gate animation. **After clearing the first indoor hall**, unlock the first presentation of a progressive pyramid cutaway map. The map initially shows discovered entrance, first hall and the newly revealed connection/room only. Undiscovered secrets and deeper levels stay hidden. This is a core system to design next, **not a reason to rush a map or unapproved interior room into this prologue task**.

## Implementation boundaries and agent workflow
- Implement on a dedicated branch based on current `main`; protect existing experiment branches and PR #1. Preserve existing playable experiments; no destructive reset or broad rewrite without explicit approval.
- Consult `CLAUDE.md`, `AGENTS.md`, `docs/agents/WORKFLOW.md`. Opus retains creative/art/gameplay ownership; delegate narrow file discovery, tests, small typing/data edits to Haiku; assign bounded multi-file integration to Sonnet when it truly saves time.
- Keep reusable and versioned: art-generation sources, artifact engraving definitions, scene data, puzzle logic, cinematic transitions. Avoid huge speculative general-purpose engines.
- Prefer art-directed high-quality results to checklist completion. Verify rendered animation and overlap, not just successful compilation.
- Keep commands reproducible and build/static-GitHub-Pages-friendly; avoid giant intermediate assets in Git.
- Separate copy/design proposals from settled facts; if substantial story or UI decisions differ from this brief, record the choices and ask for approval.

## Acceptance criteria
- Cohesive title and cinematic story intro, responsive and readable.
- Miniature can be inspected; its unique carvings are recognizable and consistent across scenes.
- A **wide and explorable** outdoor pyramid scene in premium pixel art.
- Solvable, forgiving sun-and-eye alignment puzzle with environmental clues and mobile controls.
- Polished, physically correct entrance animation (correct masks, layering, dust).
- Persistent unlocked entrance and continued possession of the artifact.
- Existing adventure/experiment scenes unaffected; automated puzzle/state tests, build/typecheck/lint; report what was visually inspected on desktop and portrait phone and what could not be verified.
- No moon entrance, no hard mode, no second interior puzzle and no final pyramid map in this delivery. Those are documented follow-ups.

## Open decisions
- Precise origin of grandfather's artifact, protagonist identity and pyramid's actual ancient name remain intentionally undisclosed.
- Sound/music may be staged with hooks/placeholders; asset choices require review.
- Exact engraved motif meanings will be designed alongside future puzzles to avoid retconning early imagery.
