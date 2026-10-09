import type { RoomDefinition } from './types';

const bounds = { x: 0, y: 0, width: 3000, height: 1600 };

export const rooms: Record<string, RoomDefinition> = {
  entrance: {
    id: 'entrance',
    title: 'Förkammaren',
    intro:
      'Sand faller från fogarna. En rad tecken löper längs den slutna porten.',
    worldBounds: bounds,
    background: {
      top: 0x35271c,
      bottom: 0x17120f,
      wall: 0x80674a,
      accent: 0xd7af69,
    },
    presentation: {
      backgroundImage: 'assets/rooms/entrance-placeholder.svg',
      columns: [],
      alcoves: [],
      torchPositions: [270, 2700],
      objects: [
        {
          id: 'stone-vessel',
          visual: 'vessel',
          area: { x: 690, y: 650, width: 300, height: 380 },
        },
        {
          id: 'glyph-panel',
          visual: 'relief',
          area: { x: 1470, y: 420, width: 300, height: 410 },
        },
        {
          id: 'sequence-lock',
          visual: 'pedestal',
          area: { x: 1940, y: 690, width: 270, height: 250 },
        },
      ],
      doorways: [{ exitId: 'to-relief', width: 440, height: 710 }],
    },
    mapGeometry: { floor: 0, x: 200, y: 930, width: 500, height: 180 },
    exits: [
      {
        id: 'to-relief',
        destinationRoomId: 'relief',
        requiredPuzzleId: 'glyph-sequence',
        x: 2490,
      },
    ],
    hotspots: [
      {
        id: 'stone-vessel',
        label: 'Stenkärlet',
        description:
          'Ett tungt kärl av mörk sten. Damm ligger kvar längs kanten.',
        area: { x: 690, y: 650, width: 300, height: 380 },
        focus: { x: 840, y: 840, zoom: 1.25 },
      },
      {
        id: 'glyph-panel',
        label: 'Teckenraden',
        description: 'En sol, en flod och ett öga pekar mot portens ordning.',
        area: { x: 1470, y: 420, width: 300, height: 410 },
        focus: { x: 1620, y: 630, zoom: 1.3 },
      },
      {
        id: 'sequence-lock',
        label: 'Stjärnornas lås',
        description:
          'Tre symboler kan tryckas i en följd. Ledtråden sitter i rummet.',
        area: { x: 1940, y: 690, width: 270, height: 250 },
        focus: { x: 2075, y: 815, zoom: 1.35 },
        puzzleId: 'glyph-sequence',
      },
      {
        id: 'east-door',
        label: 'Den slutna porten',
        description: 'Tunga stenblad håller vägen vidare stängd.',
        area: { x: 2440, y: 380, width: 440, height: 700 },
        focus: { x: 2660, y: 700, zoom: 1.2 },
        exitId: 'to-relief',
      },
    ],
  },
  relief: {
    id: 'relief',
    title: 'Vågkammaren',
    intro: 'Ett stenlejon vaktar vågen. Tre vikter ligger kvar vid dess fot.',
    worldBounds: bounds,
    background: {
      top: 0x30251d,
      bottom: 0x120f0d,
      wall: 0x70604c,
      accent: 0xc9a260,
    },
    presentation: {
      columns: [360, 850, 2180, 2670],
      alcoves: [1200, 1840],
      torchPositions: [480, 2330],
      objects: [
        {
          id: 'lion-relief',
          visual: 'relief',
          area: { x: 570, y: 400, width: 350, height: 490 },
        },
        {
          id: 'balance-lock',
          visual: 'pedestal',
          area: { x: 1370, y: 670, width: 360, height: 300 },
        },
      ],
      doorways: [
        { exitId: 'back-entrance', width: 360, height: 710 },
        { exitId: 'to-inner', width: 440, height: 710 },
      ],
    },
    mapGeometry: { floor: 0, x: 1050, y: 800, width: 520, height: 190 },
    exits: [
      {
        id: 'back-entrance',
        destinationRoomId: 'entrance',
        initiallyUnlocked: true,
        x: 310,
      },
      {
        id: 'to-inner',
        destinationRoomId: 'inner',
        requiredPuzzleId: 'balanced-stones',
        x: 2490,
      },
    ],
    hotspots: [
      {
        id: 'lion-relief',
        label: 'Lejonreliefen',
        description:
          'Den ena vågskålen visar en vikt på tre stenar. En stilla ledtråd till balansen.',
        area: { x: 570, y: 400, width: 350, height: 490 },
        focus: { x: 745, y: 650, zoom: 1.3 },
      },
      {
        id: 'balance-lock',
        label: 'Stenvågen',
        description: 'Fördela vikterna så att vågen står jämnt.',
        area: { x: 1370, y: 670, width: 360, height: 300 },
        focus: { x: 1550, y: 820, zoom: 1.3 },
        puzzleId: 'balanced-stones',
      },
      {
        id: 'sun-door',
        label: 'Den inre porten',
        description: 'En port av mörk granit leder längre in.',
        area: { x: 2440, y: 380, width: 440, height: 700 },
        focus: { x: 2660, y: 700, zoom: 1.2 },
        exitId: 'to-inner',
      },
      {
        id: 'return-door',
        label: 'Vägen tillbaka',
        description: 'Den öppna gången leder tillbaka till förkammaren.',
        area: { x: 120, y: 400, width: 380, height: 650 },
        focus: { x: 310, y: 700, zoom: 1.2 },
        exitId: 'back-entrance',
      },
    ],
  },
  inner: {
    id: 'inner',
    title: 'Solkammaren',
    intro: 'Här är luften stilla. En tunn ljusstrimma dör mot en spegelport.',
    worldBounds: bounds,
    background: {
      top: 0x28231e,
      bottom: 0x0d0c0b,
      wall: 0x665c4d,
      accent: 0xe0bf7e,
    },
    presentation: {
      columns: [300, 850, 2180, 2670],
      alcoves: [1500],
      torchPositions: [500, 2260],
      objects: [
        {
          id: 'mirror-array',
          visual: 'mirror',
          area: { x: 1120, y: 420, width: 420, height: 410 },
        },
        {
          id: 'sun-disc',
          visual: 'pedestal',
          area: { x: 2050, y: 690, width: 280, height: 280 },
        },
      ],
      doorways: [
        { exitId: 'back-relief', width: 360, height: 710 },
        { exitId: 'to-reveal', width: 440, height: 710 },
      ],
    },
    mapGeometry: { floor: 0, x: 1900, y: 680, width: 520, height: 190 },
    exits: [
      {
        id: 'back-relief',
        destinationRoomId: 'relief',
        initiallyUnlocked: true,
        x: 310,
      },
      {
        id: 'to-reveal',
        destinationRoomId: 'ending',
        requiredPuzzleId: 'sun-mirrors',
        x: 2670,
      },
    ],
    hotspots: [
      {
        id: 'mirror-array',
        label: 'Solens speglar',
        description: 'Tre speglar kan vridas. Rikta ljuset mot solskivan.',
        area: { x: 1120, y: 420, width: 420, height: 410 },
        focus: { x: 1330, y: 625, zoom: 1.3 },
        puzzleId: 'sun-mirrors',
      },
      {
        id: 'sun-disc',
        label: 'Solskivan',
        description: 'En gyllene skiva sitter infälld i den innersta porten.',
        area: { x: 2050, y: 690, width: 280, height: 280 },
        focus: { x: 2190, y: 830, zoom: 1.3 },
      },
      {
        id: 'inner-door',
        label: 'Den innersta porten',
        description: 'Ljuset låser upp ett sigill i den massiva porten.',
        area: { x: 2440, y: 380, width: 440, height: 700 },
        focus: { x: 2660, y: 700, zoom: 1.2 },
        exitId: 'to-reveal',
      },
      {
        id: 'return-relief',
        label: 'Gången tillbaka',
        description: 'En öppen passage återvänder till vågkammaren.',
        area: { x: 120, y: 400, width: 380, height: 650 },
        focus: { x: 310, y: 700, zoom: 1.2 },
        exitId: 'back-relief',
      },
    ],
  },
};
