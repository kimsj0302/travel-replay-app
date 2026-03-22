import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { subscribeMapPaneSize } from '../stores/replayMapPaneStore';
import { buildPhotoMarkerFeatures } from '../utils/photoMapFeatures';
import {
  PHOTO_PIN_EXIF_ID,
  PHOTO_PIN_INTERP_ID,
  registerPhotoPinImages,
} from '../utils/photoMapPinImages';
import { FixedZoomControl } from '../map/fixedZoomControl';
import type { TrackPoint, TripPhoto } from '../types';

const PHOTO_PIN_LAYER_ID = 'photo-groups-pins';

interface MapViewProps {
  track: TrackPoint[];
  /** 시각 순 정렬 — 핀 인덱스 = 재생 인덱스 */
  photosSorted: TripPhoto[];
  currentPosition: { lat: number; lon: number } | null;
  onPhotoClick?: (photoIndex: number) => void;
  photoPanelOpen?: boolean;
  panToPhotoMarker?: { photoIndex: number; seq: number } | null;
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const NATIVE_OSM_MAX_ZOOM = 17;
const MAP_MAX_ZOOM = 18;

const MAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors | <a href="https://maplibre.org/" target="_blank" rel="noreferrer">MapLibre</a>';

const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export default function MapView({
  track,
  photosSorted,
  currentPosition,
  onPhotoClick,
  photoPanelOpen = false,
  panToPhotoMarker = null,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onPhotoClickRef = useRef(onPhotoClick);
  onPhotoClickRef.current = onPhotoClick;
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
      center: center as [number, number],
      zoom: 14,
      maxZoom: MAP_MAX_ZOOM,
    });

    map.addControl(new FixedZoomControl(), 'top-right');
    map.addControl(
      new maplibregl.NavigationControl({ showZoom: false, showCompass: true }),
      'top-right',
    );

    map.on('load', () => {
      const fitPad = {
        padding: 60,
        maxZoom: Math.max(4, Math.min(NATIVE_OSM_MAX_ZOOM, MAP_MAX_ZOOM - 1)),
      } as const;

      const extendBoundsWithPhotoMarkers = (bounds: maplibregl.LngLatBounds) => {
        for (const f of buildPhotoMarkerFeatures(photosSorted)) {
          const coordsPt = (f.geometry as GeoJSON.Point).coordinates;
          bounds.extend(coordsPt as [number, number]);
        }
      };

      if (track.length >= 2) {
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
        extendBoundsWithPhotoMarkers(bounds);
        map.fitBounds(bounds, fitPad);
      } else if (track.length === 1) {
        const p = track[0]!;
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          },
        });
        map.addLayer({
          id: 'route-line',
          type: 'circle',
          source: 'route',
          paint: {
            'circle-radius': 10,
            'circle-color': '#3b82f6',
            'circle-opacity': 1,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffffff',
          },
        });
        const bounds = new maplibregl.LngLatBounds();
        bounds.extend([p.lon, p.lat]);
        extendBoundsWithPhotoMarkers(bounds);
        map.fitBounds(bounds, fitPad);
      } else {
        const markerFeatures = buildPhotoMarkerFeatures(photosSorted);
        if (markerFeatures.length > 0) {
          const bounds = new maplibregl.LngLatBounds();
          for (const f of markerFeatures) {
            const coordsPt = (f.geometry as GeoJSON.Point).coordinates;
            bounds.extend(coordsPt as [number, number]);
          }
          map.fitBounds(bounds, fitPad);
        }
      }

      const wirePhotoPinInteractions = () => {
        map.on('click', PHOTO_PIN_LAYER_ID, (e) => {
          const f = e.features?.[0];
          if (!f || !f.properties) return;
          const idx = f.properties['photoIndex'];
          if (typeof idx === 'number') {
            onPhotoClickRef.current?.(idx);
          }
        });

        map.on('mouseenter', PHOTO_PIN_LAYER_ID, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', PHOTO_PIN_LAYER_ID, () => {
          map.getCanvas().style.cursor = '';
        });
      };

      const addPhotoAndPositionLayers = () => {
        map.addSource('photo-groups', {
          type: 'geojson',
          data: emptyFC,
        });

        map.addLayer({
          id: PHOTO_PIN_LAYER_ID,
          type: 'symbol',
          source: 'photo-groups',
          layout: {
            'icon-image': [
              'match',
              ['get', 'posSource'],
              'interpolated',
              PHOTO_PIN_INTERP_ID,
              PHOTO_PIN_EXIF_ID,
            ],
            'icon-size': 0.88,
            'icon-anchor': 'bottom',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
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
            'circle-radius': 9,
            'circle-color': '#3b82f6',
            'circle-opacity': 1,
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#ffffff',
          },
        });

        map.moveLayer('current-position-circle');

        wirePhotoPinInteractions();
        setStyleReady(true);
      };

      registerPhotoPinImages(map)
        .then(addPhotoAndPositionLayers)
        .catch((err) => {
          console.error('Photo pin icons failed, using circle fallback', err);
          map.addSource('photo-groups', { type: 'geojson', data: emptyFC });
          map.addLayer({
            id: PHOTO_PIN_LAYER_ID,
            type: 'circle',
            source: 'photo-groups',
            paint: {
              'circle-radius': 8,
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
          map.addSource('current-position', { type: 'geojson', data: emptyFC });
          map.addLayer({
            id: 'current-position-circle',
            type: 'circle',
            source: 'current-position',
            paint: {
              'circle-radius': 9,
              'circle-color': '#3b82f6',
              'circle-opacity': 1,
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#ffffff',
            },
          });
          map.moveLayer('current-position-circle');
          wirePhotoPinInteractions();
          setStyleReady(true);
        });
    });

    mapRef.current = map;

    return () => {
      setStyleReady(false);
      map.remove();
      mapRef.current = null;
      prevPhotoPanelRef.current = false;
    };
  }, [track, photosSorted]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const src = map.getSource('photo-groups') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;

    const features = buildPhotoMarkerFeatures(photosSorted);

    src.setData({ type: 'FeatureCollection', features });
  }, [photosSorted, styleReady]);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || !panToPhotoMarker) return;
    const p = photosSorted[panToPhotoMarker.photoIndex];
    if (!p) return;
    map.easeTo({
      center: [p.lon, p.lat],
      duration: 450,
      essential: true,
    });
  }, [panToPhotoMarker, photosSorted, styleReady]);

  return <div ref={containerRef} className="map-container" />;
}
