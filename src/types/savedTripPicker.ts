/** Saved trip entry for picker (manifest + JSON loader). */
export interface SavedTripPickable {
  key: string;
  date: string;
  title: string;
  label: string;
  /** Track preview `[lon, lat][]` only; null = no line on map */
  previewCoords: [number, number][] | null;
  load: () => Promise<unknown>;
}
