export interface HotspotDefinition {
  id: string;
  label: string;
  description: string;
  area: { x: number; y: number; width: number; height: number };
  focus: { x: number; y: number; zoom: number };
}

export interface RoomDefinition {
  id: string;
  title: string;
  background: { top: number; bottom: number; wall: number };
  exits: string[];
  hotspots: HotspotDefinition[];
}
