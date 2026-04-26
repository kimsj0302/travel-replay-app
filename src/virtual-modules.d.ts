declare module 'virtual:trip-manifest' {
  const manifest: Array<{
    file: string;
    title: string;
    date: string;
    /** `[lon, lat][]` from `track` only; null if no valid track points */
    preview: [number, number][] | null;
  }>;
  export default manifest;
}
