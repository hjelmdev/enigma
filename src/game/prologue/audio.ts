/**
 * Sound hooks. No audio assets are approved yet, so cues are dispatched as
 * DOM events ('enigma:cue') that a future audio layer can subscribe to.
 */
export type AudioCue =
  | 'box-open'
  | 'sun-catch'
  | 'beam-near'
  | 'eye-ignite'
  | 'stone-rumble'
  | 'stone-slide'
  | 'stone-settle'
  | 'cool-air'
  // Chapter 1 hall
  | 'stone-slide-small'
  | 'stone-settle-small'
  | 'stone-thud'
  | 'mechanism-click'
  | 'weight-clink'
  | 'lever-pull'
  | 'scale-unlock'
  | 'map-awaken'
  | 'map-pulse';

export function playCue(cue: AudioCue) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('enigma:cue', { detail: { cue } }));
}
