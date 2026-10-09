import type { RoomDefinition } from './types';

// Placeholder scene content. Coordinates use the 1280 × 720 reference canvas.
export const rooms: Record<string, RoomDefinition> = {
  entrance: {
    id: 'entrance',
    title: 'Förkammaren',
    background: { top: 0x36291d, bottom: 0x16120f, wall: 0x796044 },
    exits: [],
    hotspots: [
      {
        id: 'stone-vessel',
        label: 'Stenkärlet',
        description:
          'Ett tungt kärl av mörk sten. Damm ligger kvar längs kanten.',
        area: { x: 0.17, y: 0.48, width: 0.2, height: 0.35 },
        focus: { x: 0.27, y: 0.63, zoom: 2.1 },
      },
      {
        id: 'wall-carving',
        label: 'Väggreliefen',
        description:
          'En sliten relief fångar det varma ljuset. Tecknen är ännu svåra att urskilja.',
        area: { x: 0.67, y: 0.27, width: 0.2, height: 0.35 },
        focus: { x: 0.77, y: 0.45, zoom: 2.25 },
      },
    ],
  },
};
