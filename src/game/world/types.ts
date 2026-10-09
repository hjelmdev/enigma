export interface HotspotDefinition {
  id: string;
  label: string;
  description: string;
  visual: 'vessel' | 'relief';
  // All positions use the room's authored world coordinate system.
  area: { x: number; y: number; width: number; height: number };
  // The camera moves to this world-space point before applying the zoom.
  focus: { x: number; y: number; zoom: number };
}

export interface RoomDefinition {
  id: string;
  title: string;
  worldBounds: { x: number; y: number; width: number; height: number };
  background: { top: number; bottom: number; wall: number };
  exits: string[];
  hotspots: HotspotDefinition[];
}
