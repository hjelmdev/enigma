export type PuzzleId = 'glyph-sequence' | 'balanced-stones' | 'sun-mirrors';

export interface HotspotDefinition {
  id: string;
  label: string;
  description: string;
  visual: 'vessel' | 'relief' | 'pedestal' | 'mirror' | 'door';
  area: { x: number; y: number; width: number; height: number };
  focus: { x: number; y: number; zoom: number };
  puzzleId?: PuzzleId;
  exitId?: string;
}

export interface ExitDefinition {
  id: string;
  destinationRoomId: string;
  requiredPuzzleId?: PuzzleId;
  initiallyUnlocked?: boolean;
  x: number;
}

export interface RoomDefinition {
  id: string;
  title: string;
  intro: string;
  worldBounds: { x: number; y: number; width: number; height: number };
  background: { top: number; bottom: number; wall: number; accent: number };
  mapGeometry: {
    floor: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  exits: ExitDefinition[];
  hotspots: HotspotDefinition[];
}
