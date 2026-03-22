import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { subscribeMapPaneSize } from '../stores/replayMapPaneStore';
import { buildPhotoGroupMarkerFeatures } from '../utils/photoMapFeatures';
import type { TrackPoint, PhotoGroup } from '../types';

interface MapViewProps {
  track: TrackPoint[];
  groups: PhotoGroup[];
  currentPosition: { lat: number; lon: number } | null;
  onGroupClick?: (groupIndex: number) => void;
  /** 우측 사진 패널이 열릴 때 지도 리사이즈 및 마커가 보이도록 이동 */
  photoPanelOpen?: boolean;
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export default function MapView({
  track,
  groups,
  currentPosition,
  onGroupClick,
  photoPanelOpen = false,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onGroupClickRef = useRef(onGroupClick);
  onGroupClickRef.current = onGroupClick;
  const prevPhotoPanelRef = useRef(false);
  const currentPositionRef = useRef(currentPosition);
  currentPositionRef.current = currentPosition;

  const [styleReady, setStyleReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const center =
      track.length > 0
        ? [track[Math.floor(track.length / 2)].lon, track[Math.floor(track.length / 2)].lat]
        : [127.0, 37.5];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: [TILE_URL],
            tileSize: 256,
            maxzoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: center as [number, number],
      zoom: 14,
      maxZoom: 19,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      if (track.length > 1) {
        const coords = track.map((p) => [p.lon, p.lat] as [number, number]);

        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: coords },
          },
        });

        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#3b82f6', 'line-width': 4, 'line-opacity': 0.8 },
        });

        const bounds = new maplibregl.LngLatBounds();
        coords.forEach((c) => bounds.extend(c));
        for (const f of buildPhotoGroupMarkerFeatures(groups)) {
          const coordsPt = (f.geometry as GeoJSON.Point).coordinates;
          bounds.extend(coordsPt as [number, number]);
        }
        map.fitBounds(bounds, { padding: 60, maxZoom: 18 });
      }

      map.addSource('photo-groups', {
        type: 'geojson',
        data: emptyFC,
      });

      map.addLayer({
        id: 'photo-groups-circles',
        type: 'circle',
        source: 'photo-groups',
        paint: {
          'circle-radius': 9,
          'circle-color': [
            'match',
            ['get', 'posSource'],
            'interpolated',
            '#94a3b8',
            '#f97316',
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.addSource('current-position', {
        type: 'geojson',
        data: emptyFC,
      });

      map.addLayer({
        id: 'current-position-circle',
        type: 'circle',
        source: 'current-position',
        paint: {
          'circle-radius': 7,
          'circle-color': '#3b82f6',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.on('click', 'photo-groups-circles', (e) => {
        const f = e.features?.[0];
        if (!f || !f.properties) return;
        const idx = f.properties['groupIndex'];
        if (typeof idx === 'number') {
          onGroupClickRef.current?.(idx);
        }
      });

      map.on('mouseenter', 'photo-groups-circles', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'photo-groups-circles', () => {
        map.getCanvas().style.cursor = '';
      });

      setStyleReady(true);
    });

    mapRef.current = map;

    return () => {
      setStyleReady(false);
      map.remove();
      mapRef.current = null;
      prevPhotoPanelRef.current = false;
    };
  }, [track]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const src = map.getSource('photo-groups') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    const features = buildPhotoGroupMarkerFeatures(groups);

    src.setData({ type: 'FeatureCollection', features });
  }, [groups, styleReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const src = map.getSource('current-position') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    if (!currentPosition) {
      src.setData(emptyFC);
      return;
    }

    src.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: [currentPosition.lon, currentPosition.lat],
          },
        },
      ],
    });
  }, [currentPosition, styleReady]);

  /** `.replay-map-pane`에서 커밋된 크기만 반영 (TripReplayPage + replayMapPaneStore) */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    return subscribeMapPaneSize(() => {
      map.resize();
    });
  }, [styleReady, track]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const opened = photoPanelOpen && !prevPhotoPanelRef.current;
    prevPhotoPanelRef.current = photoPanelOpen;

    if (!opened) return;

    const rafId = requestAnimationFrame(() => {
      const p = currentPositionRef.current;
      if (!p || !mapRef.current) return;
      mapRef.current.easeTo({
        center: [p.lon, p.lat],
        duration: 400,
        essential: true,
      });
    });

    return () => cancelAnimationFrame(rafId);
  }, [photoPanelOpen, styleReady]);

  return <div ref={containerRef} className="map-container" />;
}
