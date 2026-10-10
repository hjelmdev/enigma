# Stjärnornas kammare

## Room and route

The Chamber of Stars is a side room reached through the already-unlocked balance door in the Entrance Hall. The Hall's balance puzzle still controls that door, and its other exit remains unchanged. The chamber's return arch leads back to the Hall. Both map connections are recorded in the pyramid graph; the chamber and its return path become visible when the player discovers the room.

The room uses a bounded 1600 × 720 world. On desktop, pointer drag and arrow keys pan the view; on touch screens, dragging pans in both axes, including portrait layouts. The player can inspect a carved star chart and an east-west horizon relief, operate the central instrument, and find a concealed cartouche below the floor edge. The optional secret is persisted independently from the main puzzle.

## The Lost Constellation

The close-up presents four named star patterns on a rotatable bronze sighting disc inspired by a merkhet. The disc begins two quarter-turns from its intended orientation. The player must first discover both room clues:

* The chart says the target has three lights in one straight row, with two more at opposite map edges.
* The horizon relief marks the eastern light as rising, the western light as setting, and the sighting point as north.

Together, these clues identify **Vassfågeln** (the Wading Bird), the only chart with the required five-star arrangement and orientation. In the puzzle model it is the `reed` alignment at rotation `0`. The other charts share some visual properties but do not satisfy both clues. Selecting an alignment and rotating the disc are separate actions; the model accepts the solution only when both clues have been discovered and the alignment and orientation are correct. Incorrect attempts provide a short reason based on the mismatch instead of penalizing exploration.

On success, the bronze disc locks into place, a brief light-and-sound response plays, and the overhead shutters retract to expose the full star field and its constellation. This state persists, so returning to the room does not require solving the instrument again.

## Art and implementation

`tools/generate-star-chamber-art.mjs` generates seeded pixel-art layers under `public/assets/stars/`: chamber stonework, general sky, the solved constellation, shutters, instrument glow, foreground and the fullscreen instrument close-up. The Phaser room composes these layers so the constellation appears only after success. `StarChamberScene` owns exploration, camera panning and room interactions; `StarPuzzleScene` owns the responsive fullscreen interaction; `lostConstellation.ts` holds the deterministic puzzle rules.

Save schema v4 stores the selected alignment, rotation, solved flag, discovered clue IDs, optional secret, aperture animation and chamber camera. Earlier save versions migrate with a default unsolved chamber state. Save sanitation rejects unknown alignment/clue values and inconsistent solved states.
