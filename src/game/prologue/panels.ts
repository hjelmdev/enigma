import type Phaser from 'phaser';
import { TEXT } from './content';
import { assetUrl } from './assets';
import { paintMiniatureCanvas } from './miniatureTexture';
import { ICONS, repeatOnHold } from './overlay';
import type { Overlay } from './overlay';
import { progress } from './progress';

export const INSPECT_LIGHT = { x: 0.55, y: 0.7, z: -0.45 };

/** Grandfather's note: handwriting with an accessible print toggle. */
export function openNotePanel(overlay: Overlay, onClose?: () => void) {
  const wrap = document.createElement('div');
  const note = document.createElement('div');
  note.className = 'pro-note';
  note.style.backgroundImage = `url(${assetUrl('note')})`;
  const lines = document.createElement('div');
  lines.className = 'pro-note-lines';
  for (const line of TEXT.note.lines) {
    const p = document.createElement('p');
    p.textContent = line;
    lines.appendChild(p);
  }
  const sign = document.createElement('p');
  sign.className = 'pro-note-sign';
  sign.textContent = TEXT.note.signature;
  lines.appendChild(sign);
  note.appendChild(lines);
  wrap.appendChild(note);
  const row = document.createElement('div');
  row.className = 'pro-row';
  wrap.appendChild(row);
  const toggle = overlay.button(
    TEXT.note.showTranscript,
    () => {
      const print = note.classList.toggle('is-print');
      toggle.textContent = print
        ? TEXT.note.showHandwriting
        : TEXT.note.showTranscript;
    },
    'pro-btn pro-btn-quiet',
    row,
  );
  return overlay.panel(TEXT.note.title, wrap, {
    onClose,
    className: 'pro-panel-note',
  });
}

/** Inventory inspector: turn the miniature with drag or buttons. */
export function openInspectorPanel(overlay: Overlay, onClose?: () => void) {
  const wrap = document.createElement('div');
  wrap.className = 'pro-inspector';
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    'Miniatyrpyramiden. Dra eller använd knapparna för att vrida den.',
  );
  wrap.appendChild(canvas);
  const state = { yaw: 180, pitch: 0 };
  const draw = () =>
    paintMiniatureCanvas(canvas, {
      yaw: state.yaw,
      pitch: state.pitch,
      light: INSPECT_LIGHT,
      scale: 0.34,
      viewTilt: 18,
    });
  const turn = (dy: number, dp: number) => {
    state.yaw = (state.yaw + dy + 360) % 360;
    state.pitch = Math.max(-70, Math.min(70, state.pitch + dp));
    draw();
  };
  let drag: { x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', (event) => {
    drag = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    turn(-(event.clientX - drag.x) * 0.9, -(event.clientY - drag.y) * 0.6);
    drag = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('pointerup', () => (drag = null));
  canvas.addEventListener('pointercancel', () => (drag = null));
  const row = document.createElement('div');
  row.className = 'pro-row';
  wrap.appendChild(row);
  const controls: Array<[string, string, number, number]> = [
    [TEXT.ui.turnLeft, ICONS.left, 6, 0],
    [TEXT.ui.turnRight, ICONS.right, -6, 0],
    [TEXT.ui.tiltUp, ICONS.up, 0, 5],
    [TEXT.ui.tiltDown, ICONS.down, 0, -5],
  ];
  for (const [label, icon, dy, dp] of controls) {
    const b = overlay.iconButton(
      { id: label, label, icon, onClick: () => {} },
      row,
    );
    repeatOnHold(b, () => turn(dy, dp));
  }
  draw();
  const text = document.createElement('p');
  text.textContent = TEXT.captions.miniature;
  wrap.appendChild(text);
  return overlay.panel(TEXT.ui.artifact, wrap, { onClose });
}

export function openSettingsPanel(
  overlay: Overlay,
  scene: Phaser.Scene,
  onClose?: () => void,
) {
  const wrap = document.createElement('div');
  wrap.className = 'pro-settings';
  const toggle = (label: string, key: 'reduceMotion' | 'largeText') => {
    const l = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = progress.settings[key];
    input.addEventListener('change', () =>
      progress.updateSettings({ [key]: input.checked }),
    );
    l.appendChild(input);
    l.appendChild(document.createTextNode(label));
    wrap.appendChild(l);
  };
  toggle(TEXT.settings.reduceMotion, 'reduceMotion');
  toggle(TEXT.settings.largeText, 'largeText');
  const row = document.createElement('div');
  row.className = 'pro-row';
  wrap.appendChild(row);
  const reset = overlay.button(
    TEXT.settings.resetSave,
    async () => {
      await progress.reset();
      reset.disabled = true;
      reset.textContent = TEXT.settings.resetDone;
    },
    'pro-btn pro-btn-quiet',
    row,
  );
  reset.disabled = !progress.hasSave;
  overlay.button(
    TEXT.settings.experiments,
    () => {
      overlay.destroy();
      document.body.classList.remove('pixel-mode');
      scene.scene.start('menu');
    },
    'pro-btn pro-btn-quiet',
    row,
  );
  return overlay.panel(TEXT.settings.title, wrap, { onClose });
}
