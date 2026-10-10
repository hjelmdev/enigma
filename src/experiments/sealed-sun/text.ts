import type { GlyphId } from './art/glyphs.ts';

/**
 * Player-facing text for the experiment (Swedish, like the rest of the game).
 * Proposal copy, not story canon.
 */
export const GLYPH_NAMES: Record<GlyphId, string> = {
  sun: 'solskivan',
  moon: 'månskäran',
  star: 'stjärnan',
  eye: 'ögat',
  ankh: 'ankh-korset',
  feather: 'fjädern',
  lotus: 'lotusblomman',
  water: 'vattnet',
  scarab: 'skarabén',
  cobra: 'kobran',
  falcon: 'falken',
  fish: 'fisken',
  djed: 'djed-pelaren',
  reed: 'vassen',
  owl: 'ugglan',
  hand: 'armen',
  mountain: 'bergen',
  house: 'huset',
  bread: 'brödet',
  basket: 'korgen',
  vase: 'krukan',
  shen: 'shen-ringen',
  sedge: 'säven',
};

export const TEXT = {
  title: 'Den förseglade solens kammare',
  intro:
    'Facklorna brinner fortfarande. En port av röd granit stänger vägen, och på en stenfot vilar ett sigill av tre ringar.',
  introOpen:
    'Granitporten har sjunkit ner i golvet. Trappan bortom stiger mot ett gyllene ljus.',
  doorClosed:
    'Graniten rubbas inte. En ränna av guld löper i golvet från sigillet fram till tröskeln.',
  doorOpen:
    'Trappan stiger mot ett gyllene ljus. Här slutar experimentet, men vägen fortsätter.',
  steleTitle: 'Stelen',
  steleCaption:
    'En stele i kalksten. Överst skjuter skarabén solskivan upp över bergen, så som solen föds varje morgon.',
  steleReturn:
    'Solskivan, skarabén och bergen, uppifrån och ned. Bilden måste betyda något.',
  sealTitle: 'Solsigillet',
  sealIntro:
    'Tre stenringar kring en gyllene sol. Bronsfönstret överst visar ett tecken från varje ring. Välj en ring och vrid den.',
  sealLocked:
    'Sigillet är låst i sitt rätta läge. Fönstret visar solskivan, skarabén och bergen.',
  sealReturn: 'Ringarna vilar där du lämnade dem.',
  sealSolving: 'Ringarna låser sig med ett djupt klick. Ljus samlas i solen.',
  linkOuter: 'Den yttre ringen drar med sig den mellersta.',
  linkMiddle: 'Den mellersta ringen drar med sig den inre.',
  activation: 'Guldet i golvet vaknar. Ljuset löper fram mot porten.',
  opening: 'Sand rinner ur slussarna vid porten. Graniten börjar sjunka.',
  opened: 'Porten har sjunkit ner i golvet. Den förblir öppen.',
  reset: 'Experimentet är återställt.',
} as const;

export function windowText(glyphs: GlyphId[]) {
  return `I fönstret: ${glyphs.map((g) => GLYPH_NAMES[g]).join(' · ')}`;
}
