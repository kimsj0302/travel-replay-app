declare module 'virtual:trip-manifest' {
  const manifest: Array<{
    file: string;
    title: string;
    date: string;
    /** `[lon, lat][]` from `track` only; null if no valid track points */
    preview: [number, number][] | null;
    /** Photo positions using explicit GPS or track-time interpolation */
    photoPoints: [number, number][];
    sourcePosts: Array<{
      url: string;
      photoCount: number;
    }>;
  }>;
  export default manifest;
}
