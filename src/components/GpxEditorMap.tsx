import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { TrackPoint } from '../types';
import { normalizeGeoBounds, type GeoBounds, selectTrackPointIndicesInBounds } from '../utils/gpxSelection';

interface GpxEditorMapProps {
  trackPoints: TrackPoint[];
  selectedIndices: number[];
  selectionEnabled: boolean;
  fitSeq: number;
  onSelectionChange: (indices: number[]) => void;
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const NATIVE_OSM_MAX_ZOOM = 17;
const MAP_MAX_ZOOM = 18;
const MAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors | <a href="https://maplibre.org/" target="_blank" rel="noreferrer">MapLibre</a>';
const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

interface PixelPoint {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildTrackFeature(trackPoints: TrackPoint[]): GeoJSON.FeatureCollection | GeoJSON.Feature {
  if (trackPoints.length >= 2) {
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: trackPoints.map((point) => [point.lon, point.lat]),
      },
    };
  }

  return emptyFC;
}

function buildPointFeatures(trackPoints: TrackPoint[], indices?: number[]): GeoJSON.FeatureCollection {
  const indexSet = indices ? new Set(indices) : null;
  return {
    type: 'FeatureCollection',
    features: trackPoints.flatMap((point, index) => {
      if (indexSet && !indexSet.has(index)) return [];
      return [
        {
          type: 'Feature' as const,
          properties: { index },
          geometry: {
            type: 'Point' as const,
            coordinates: [point.lon, point.lat],
          },
        },
      ];
    }),
  };
}

function buildBoundsFromPixels(
  start: PixelPoint,
  end: PixelPoint,
  map: maplibregl.Map,
): GeoBounds {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  const northWest = map.unproject([minX, minY]);
  const southEast = map.unproject([maxX, maxY]);

  return normalizeGeoBounds({
    minLat: southEast.lat,
    maxLat: northWest.lat,
    minLon: northWest.lng,
    maxLon: southEast.lng,
  });
}

function buildSelectionFeature(
  start: PixelPoint,
  end: PixelPoint,
  map: maplibregl.Map,
): GeoJSON.FeatureCollection {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  const northWest = map.unproject([minX, minY]);
  const northEast = map.unproject([maxX, minY]);
  const southEast = map.unproject([maxX, maxY]);
  const southWest = map.unproject([minX, maxY]);

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [northWest.lng, northWest.lat],
            [northEast.lng, northEast.lat],
            [southEast.lng, southEast.lat],
            [southWest.lng, southWest.lat],
            [northWest.lng, northWest.lat],
          ]],
        },
      },
    ],
  };
}

export default function GpxEditorMap({
  trackPoints,
  selectedIndices,
  selectionEnabled,
  fitSeq,
  onSelectionChange,
}: GpxEditorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [styleReady, setStyleReady] = useState(false);
  const dragStateRef = useRef<{ start: PixelPoint; rect: DOMRect } | null>(null);
  const selectedIndicesKey = useMemo(() => selectedIndices.join(','), [selectedIndices]);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      attributionControl: {
        compact: false,
        customAttribution: MAP_ATTRIBUTION,
      },
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: [TILE_URL],
            tileSize: 256,
            maxzoom: NATIVE_OSM_MAX_ZOOM,
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            paint: {
              'raster-fade-duration': 0,
              'raster-resampling': 'linear',
            },
          },
        ],
      },
      center: [127.0, 37.5],
      zoom: 12,
      maxZoom: MAP_MAX_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      map.addSource('gpx-track', { type: 'geojson', data: emptyFC });
      map.addLayer({
        id: 'gpx-track-line',
        type: 'line',
        source: 'gpx-track',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3b82f6', 'line-width': 3.5, 'line-opacity': 0.8 },
      });

      map.addSource('gpx-track-points', { type: 'geojson', data: emptyFC });
      map.addLayer({
        id: 'gpx-track-points-layer',
        type: 'circle',
        source: 'gpx-track-points',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8,
            2.5,
            12,
            3.5,
            15,
            4.5,
          ],
          'circle-color': '#2563eb',
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.addSource('gpx-selected-points', { type: 'geojson', data: emptyFC });
      map.addLayer({
        id: 'gpx-selected-points-layer',
        type: 'circle',
        source: 'gpx-selected-points',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8,
            4.5,
            12,
            6,
            15,
            7.5,
          ],
          'circle-color': '#f97316',
          'circle-opacity': 0.95,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.addSource('gpx-selection-box', { type: 'geojson', data: emptyFC });
      map.addLayer({
        id: 'gpx-selection-box-fill',
        type: 'fill',
        source: 'gpx-selection-box',
        paint: {
          'fill-color': '#38bdf8',
          'fill-opacity': 0.12,
        },
      });
      map.addLayer({
        id: 'gpx-selection-box-line',
        type: 'line',
        source: 'gpx-selection-box',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 2,
          'line-dasharray': [2, 1],
        },
      });

      setStyleReady(true);
    });

    mapRef.current = map;

    return () => {
      setStyleReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectionEnabled) {
      map.dragPan.disable();
      map.getCanvas().style.cursor = 'crosshair';
    } else {
      map.dragPan.enable();
      map.getCanvas().style.cursor = '';
      const selectionSource = map.getSource('gpx-selection-box') as maplibregl.GeoJSONSource | undefined;
      selectionSource?.setData(emptyFC);
    }
  }, [selectionEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    const trackSource = map.getSource('gpx-track') as maplibregl.GeoJSONSource | undefined;
    const pointsSource = map.getSource('gpx-track-points') as maplibregl.GeoJSONSource | undefined;
    if (!trackSource || !pointsSource) return;

    trackSource.setData(buildTrackFeature(trackPoints));
    pointsSource.setData(buildPointFeatures(trackPoints));
  }, [trackPoints, styleReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const selectedSource = map.getSource('gpx-selected-points') as maplibregl.GeoJSONSource | undefined;
    if (!selectedSource) return;
    selectedSource.setData(buildPointFeatures(trackPoints, selectedIndices));
  }, [trackPoints, selectedIndices, selectedIndicesKey, styleReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || trackPoints.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    for (const point of trackPoints) {
      bounds.extend([point.lon, point.lat]);
    }
    map.fitBounds(bounds, {
      padding: 60,
      maxZoom: Math.max(4, Math.min(NATIVE_OSM_MAX_ZOOM, MAP_MAX_ZOOM - 1)),
      duration: 0,
    });
  }, [fitSeq, styleReady, trackPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (!selectionEnabled || event.button !== 0) return;
      event.preventDefault();

      const rect = map.getCanvas().getBoundingClientRect();
      const start = {
        x: clamp(event.clientX - rect.left, 0, rect.width),
        y: clamp(event.clientY - rect.top, 0, rect.height),
      };
      dragStateRef.current = { start, rect };
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!dragStateRef.current) return;

      const selectionSource = map.getSource('gpx-selection-box') as maplibregl.GeoJSONSource | undefined;
      if (!selectionSource) return;

      const { start, rect } = dragStateRef.current;
      const current = {
        x: clamp(event.clientX - rect.left, 0, rect.width),
        y: clamp(event.clientY - rect.top, 0, rect.height),
      };
      selectionSource.setData(buildSelectionFeature(start, current, map));
    };

    const finishSelection = (event: MouseEvent) => {
      if (!dragStateRef.current) return;

      const selectionSource = map.getSource('gpx-selection-box') as maplibregl.GeoJSONSource | undefined;
      const { start, rect } = dragStateRef.current;
      dragStateRef.current = null;

      const end = {
        x: clamp(event.clientX - rect.left, 0, rect.width),
        y: clamp(event.clientY - rect.top, 0, rect.height),
      };

      selectionSource?.setData(emptyFC);

      const dragWidth = Math.abs(end.x - start.x);
      const dragHeight = Math.abs(end.y - start.y);
      if (dragWidth < 3 || dragHeight < 3) {
        onSelectionChange([]);
        return;
      }

      const bounds = buildBoundsFromPixels(start, end, map);
      onSelectionChange(selectTrackPointIndicesInBounds(trackPoints, bounds));
    };

    const canvas = map.getCanvas();
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', finishSelection);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', finishSelection);
    };
  }, [onSelectionChange, selectionEnabled, styleReady, trackPoints]);

  return <div ref={containerRef} className="map-container gpx-editor-map" />;
}
