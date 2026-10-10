import {
  DOOR_HOLE,
  DOOR_SLAB,
  STAND_RECT,
  TORCHES,
  project,
} from '../layout.ts';
import {
  computeSpill,
  renderBeam,
  renderCorridor,
  renderSlab,
  type SpillPixel,
} from './doorArt.ts';
import { PALETTE } from './palette.ts';
import { PixelCanvas } from './pixelCanvas.ts';
import {
  FLAME_H,
  FLAME_W,
  renderFlames,
  renderGlow,
  renderStand,
  renderSteleFlat,
} from './propsArt.ts';
import { renderRoom } from './roomArt.ts';
import { computeChannel, type ChannelPixel } from './channel.ts';
import {
  SEAL_SIZE,
  drawSeal,
  drawSealMini,
  renderSealPlate,
} from './sealArt.ts';

export interface SealedSunArt {
  layers: {
    room: PixelCanvas;
    corridor: PixelCanvas;
    slab: PixelCanvas;
    slabGlow: PixelCanvas;
    stand: PixelCanvas;
    beam: PixelCanvas;
    glow: PixelCanvas;
    steleFlat: PixelCanvas;
    sealPlate: PixelCanvas;
    [key: string]: PixelCanvas;
  };
  flames: PixelCanvas[];
  spill: SpillPixel[];
  channel: ChannelPixel[];
  standDisc: { x: number; y: number; r: number };
}

/** Runs every generator once. Deterministic: same code, same pixels. */
export function generateSealedSunArt(): SealedSunArt {
  const { room } = renderRoom();
  const corridor = renderCorridor();
  const { slab, slabGlow } = renderSlab();
  const { stand, disc } = renderStand();
  const flames = renderFlames();
  return {
    layers: {
      room,
      corridor,
      slab,
      slabGlow,
      stand,
      beam: renderBeam(),
      glow: renderGlow(),
      steleFlat: renderSteleFlat(),
      sealPlate: renderSealPlate(),
    },
    flames,
    spill: computeSpill(),
    channel: computeChannel(),
    standDisc: disc,
  };
}

/**
 * A static composite for review: the chamber closed (`open` = 0) or open (1).
 * The game composes the same layers live with Phaser.
 */
export function composePreview(
  art: SealedSunArt,
  open: number,
  rotations = [3, 6, 2],
) {
  const out = new PixelCanvas(art.layers.room.width, art.layers.room.height);
  out.blit(art.layers.corridor, DOOR_HOLE.x, DOOR_HOLE.y);
  const drop = Math.round(open * (DOOR_HOLE.h + 2));
  out.blit(art.layers.slab, DOOR_SLAB.x, DOOR_SLAB.y + drop);
  out.blit(art.layers.room, 0, 0);
  if (open > 0) {
    for (const p of art.spill) {
      const lit = (p.threshold + 3.05) / 6.05 <= open;
      if (lit) out.put(p.x, p.y, PALETTE.gold[5], Math.round(p.strength * 110));
    }
    out.blit(fade(art.layers.beam, open), 0, 0);
  }
  out.blit(art.layers.stand, STAND_RECT.x, STAND_RECT.y);
  const mini = new PixelCanvas(art.standDisc.r * 2, art.standDisc.r * 2);
  drawSealMini(mini, rotations, 0.55, open > 0 ? 1 : 0);
  out.blit(
    mini,
    STAND_RECT.x + art.standDisc.x - art.standDisc.r,
    STAND_RECT.y + art.standDisc.y - art.standDisc.r,
  );
  for (const torch of TORCHES) {
    const p = project(torch.x, torch.y, torch.z);
    const g = art.layers.glow;
    out.blit(
      fade(g, 0.55),
      Math.round(p.x - g.width / 2),
      Math.round(p.y - g.height / 2 - 6),
    );
    out.blit(
      art.flames[0],
      Math.round(p.x - FLAME_W / 2),
      Math.round(p.y - FLAME_H + 1),
    );
  }
  return out;
}

function fade(c: PixelCanvas, alpha: number) {
  const o = new PixelCanvas(c.width, c.height);
  o.data.set(c.data);
  for (let i = 3; i < o.data.length; i += 4) o.data[i] = o.data[i] * alpha;
  return o;
}

export function sealPreview(
  art: SealedSunArt,
  rotations = [3, 6, 2],
  selected: number | null = 0,
) {
  const out = new PixelCanvas(SEAL_SIZE, SEAL_SIZE);
  drawSeal(out, art.layers.sealPlate, { angles: rotations, selected, glow: 0 });
  return out;
}
