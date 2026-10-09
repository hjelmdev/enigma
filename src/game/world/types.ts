export type PuzzleId = 'glyph-sequence' | 'balanced-stones' | 'sun-mirrors';

export type RoomObjectVisual = 'vessel' | 'relief' | 'pedestal' | 'mirror';

export type DoorVisualState = 'closed' | 'opening' | 'open';

export interface RoomObjectDefinition {
  id: string;
  visual: RoomObjectVisual;
  area: { x: number; y: number; width: number; height: number };
}

export interface DoorwayArtDefinition {
  exitId: string;
  width: number;
  height: number;
}

export interface RoomPresentationDefinition {
  /** Public asset path, for example `assets/rooms/entrance.webp`. */
  backgroundImage?: string;
  columns: number[];
  alcoves: number[];
  torchPositions: number[];
  objects: RoomObjectDefinition[];
  doorways: DoorwayArtDefinition[];
}

export interface HotspotDefinition {
  id: string;
  label: string;
  description: string;
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
  presentation: RoomPresentationDefinition;
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
