import type { RoomDefinition } from './types';

// Room and hotspot positions share one authored world space. The camera window
// changes with the device; object scale and world coordinates do not.
export const rooms: Record<string, RoomDefinition> = {
  entrance: {
    id: 'entrance',
    title: 'Förkammaren',
    worldBounds: { x: 0, y: 0, width: 3000, height: 1600 },
    background: { top: 0x36291d, bottom: 0x16120f, wall: 0x796044 },
    exits: [],
    hotspots: [
      {
        id: 'stone-vessel',
        label: 'Stenkärlet',
        description:
          'Ett tungt kärl av mörk sten. Damm ligger kvar längs kanten.',
        visual: 'vessel',
        area: { x: 700, y: 650, width: 300, height: 380 },
        focus: { x: 850, y: 840, zoom: 1.3 },
      },
      {
        id: 'wall-carving',
        label: 'Väggreliefen',
        description:
          'En sliten relief fångar det varma ljuset. Tecknen är ännu svåra att urskilja.',
        visual: 'relief',
        area: { x: 1980, y: 460, width: 340, height: 490 },
        focus: { x: 2150, y: 700, zoom: 1.3 },
      },
    ],
  },
};
