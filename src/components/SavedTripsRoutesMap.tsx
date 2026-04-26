import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { FixedZoomControl } from '../map/fixedZoomControl';
import type { SavedTripPickable } from '../types/savedTripPicker';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const NATIVE_OSM_MAX_ZOOM = 17;
const MAP_MAX_ZOOM = 18;
const MAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors | <a href="https://maplibre.org/" target="_blank" rel="noreferrer">MapLibre</a>';

const LINE_COLORS = ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#14b8a6', '#eab308'];

const SOURCE_ID = 'saved-trips-routes';
const HIT_LAYER_ID = 'saved-trips-routes-hit';
const LINE_LAYER_ID = 'saved-trips-routes-line';

export type SavedTripsRoutesMapHandle = {
  /** 리스트 등 외부에서 선택 시 카메라만 맞춤 (부모 state와 별도) */
  frameToTrip: (tripKey: string) => void;
};

function buildFeatureCollection(
  trips: SavedTripPickable[],
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  trips.forEach((trip, i) => {
    const coords = trip.previewCoords;
    if (!coords || coords.length === 0) return;
    let lineCoords = coords;
    if (coords.length === 1) {
      const p = coords[0]!;
      lineCoords = [p, p];
    }
    features.push({
      type: 'Feature',
      id: trip.key,
      properties: {
        tripKey: trip.key,
        color: LINE_COLORS[i % LINE_COLORS.length]!,
      },
      geometry: {
        type: 'LineString',
        coordinates: lineCoords,
      },
    });
  });
  return { type: 'FeatureCollection', features };
}

function applyLineSelection(map: maplibregl.Map, selectedKey: string | null) {
  if (!map.getLayer(LINE_LAYER_ID)) return;
  const selected = selectedKey ?? '';
  map.setPaintProperty(LINE_LAYER_ID, 'line-opacity', [
    'case',
    ['==', ['get', 'tripKey'], selected],
    1,
    0.45,
  ]);
  map.setPaintProperty(LINE_LAYER_ID, 'line-width', [
    'case',
    ['==', ['get', 'tripKey'], selected],
    6,
    4,
  ]);
}

const FOCUS_PADDING = 64;
const FOCUS_MAX_ZOOM = Math.max(4, Math.min(NATIVE_OSM_MAX_ZOOM, MAP_MAX_ZOOM - 1));
const FOCUS_DURATION_MS = 650;

function focusTripRoute(
  map: maplibregl.Map,
  trips: SavedTripPickable[],
  tripKey: string,
) {
  const trip = trips.find((t) => t.key === tripKey);
  const coords = trip?.previewCoords;
  if (!coords?.length) return;

  const reduceMotion =
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  const duration = reduceMotion ? 0 : FOCUS_DURATION_MS;

  const bounds = new maplibregl.LngLatBounds();
  for (const c of coords) bounds.extend(c as [number, number]);

  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const spanLng = Math.abs(ne.lng - sw.lng);
  const spanLat = Math.abs(ne.lat - sw.lat);
  const isPointLike = spanLng < 1e-5 && spanLat < 1e-5;

  if (isPointLike || coords.length === 1) {
    map.easeTo({
      center: coords[0] as [number, number],
      zoom: 15,
      duration,
    });
    return;
  }

  map.fitBounds(bounds, {
    padding: FOCUS_PADDING,
    maxZoom: FOCUS_MAX_ZOOM,
    duration,
  });
}

interface SavedTripsRoutesMapProps {
  trips: SavedTripPickable[];
  selectedKey: string | null;
  onRouteClick: (tripKey: string) => void;
}

const SavedTripsRoutesMap = forwardRef<SavedTripsRoutesMapHandle, SavedTripsRoutesMapProps>(
  function SavedTripsRoutesMap({ trips, selectedKey, onRouteClick }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const tripsRef = useRef(trips);
    const onRouteClickRef = useRef(onRouteClick);
    const selectedKeyRef = useRef(selectedKey);
    tripsRef.current = trips;
    onRouteClickRef.current = onRouteClick;
    selectedKeyRef.current = selectedKey;

    useImperativeHandle(
      ref,
      () => ({
        frameToTrip(tripKey: string) {
          const map = mapRef.current;
          if (!map?.isStyleLoaded()) return;
          requestAnimationFrame(() => {
            try {
              map.stop();
              map.resize();
              focusTripRoute(map, tripsRef.current, tripKey);
            } catch {
              /* ignore */
            }
          });
        },
      }),
      [],
    );

    const fc = buildFeatureCollection(trips);
    const hasLines = fc.features.length > 0;

    useEffect(() => {
      if (!containerRef.current || !hasLines) return;

      const fcInit = buildFeatureCollection(trips);
      const center: [number, number] =
        fcInit.features[0]?.geometry.type === 'LineString'
          ? (fcInit.features[0].geometry.coordinates[0] as [number, number])
          : [127, 37.5];

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
        center,
        zoom: 12,
        maxZoom: MAP_MAX_ZOOM,
      });

      map.addControl(new FixedZoomControl(), 'top-right');
      map.addControl(
        new maplibregl.NavigationControl({ showZoom: false, showCompass: true }),
        'top-right',
      );

      map.on('load', () => {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: fcInit,
        });

        map.addLayer({
          id: HIT_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#000000',
            'line-width': 16,
            'line-opacity': 0,
          },
        });

        map.addLayer({
          id: LINE_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 4,
            'line-opacity': 0.55,
          },
        });

        const bounds = new maplibregl.LngLatBounds();
        for (const f of fcInit.features) {
          if (f.geometry.type !== 'LineString') continue;
          for (const c of f.geometry.coordinates) {
            bounds.extend(c as [number, number]);
          }
        }
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, {
            padding: 48,
            maxZoom: Math.max(4, Math.min(NATIVE_OSM_MAX_ZOOM, MAP_MAX_ZOOM - 1)),
          });
        }

        applyLineSelection(map, selectedKeyRef.current);
        if (selectedKeyRef.current) {
          requestAnimationFrame(() => {
            try {
              map.stop();
              focusTripRoute(map, tripsRef.current, selectedKeyRef.current!);
            } catch {
              /* ignore */
            }
          });
        }

        const onClick = (e: maplibregl.MapLayerMouseEvent) => {
          const feats = map.queryRenderedFeatures(e.point, { layers: [HIT_LAYER_ID] });
          const key = feats[0]?.properties?.tripKey;
          if (typeof key !== 'string') return;
          onRouteClickRef.current(key);
        };
        map.on('click', HIT_LAYER_ID, onClick);
        map.on('mouseenter', HIT_LAYER_ID, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', HIT_LAYER_ID, () => {
          map.getCanvas().style.cursor = '';
        });

        requestAnimationFrame(() => map.resize());
      });

      mapRef.current = map;
      return () => {
        map.remove();
        mapRef.current = null;
      };
    }, [hasLines]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map?.isStyleLoaded()) return;
      const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(buildFeatureCollection(trips));
    }, [trips]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map?.isStyleLoaded()) return;
      applyLineSelection(map, selectedKey);
    }, [selectedKey]);

    if (!hasLines) {
      return null;
    }

    return <div ref={containerRef} className="saved-trips-routes-map" />;
  },
);

export default SavedTripsRoutesMap;
