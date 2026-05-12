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
const PHOTO_SOURCE_ID = 'saved-trips-photo-points';
const PHOTO_HALO_LAYER_ID = 'saved-trips-photo-points-halo';
const PHOTO_LAYER_ID = 'saved-trips-photo-points';

export interface SavedTripsMapViewportPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type SavedTripsRoutesMapHandle = {
  frameToTrip: (tripKey: string) => void;
};

const DEFAULT_PADDING: SavedTripsMapViewportPadding = {
  top: 48,
  right: 56,
  bottom: 48,
  left: 56,
};
const INITIAL_FIT_MAX_ZOOM = 13.6;
const FOCUS_MAX_ZOOM = 14.9;
const POINT_FOCUS_ZOOM = 14.4;
const FOCUS_DURATION_MS = 650;
const RESIZE_REFRAME_DEBOUNCE_MS = 120;

function buildFeatureCollection(trips: SavedTripPickable[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  trips.forEach((trip, index) => {
    const coords = trip.previewCoords;
    if (!coords || coords.length === 0) return;

    const lineCoords = coords.length === 1 ? [coords[0]!, coords[0]!] : coords;

    features.push({
      type: 'Feature',
      id: trip.key,
      properties: {
        tripKey: trip.key,
        color: LINE_COLORS[index % LINE_COLORS.length]!,
      },
      geometry: {
        type: 'LineString',
        coordinates: lineCoords,
      },
    });
  });

  return { type: 'FeatureCollection', features };
}

function buildSelectedPhotoFeatureCollection(
  trips: SavedTripPickable[],
  selectedKey: string | null,
): GeoJSON.FeatureCollection {
  if (!selectedKey) {
    return { type: 'FeatureCollection', features: [] };
  }

  const trip = trips.find((item) => item.key === selectedKey);
  if (!trip?.photoCoords.length) {
    return { type: 'FeatureCollection', features: [] };
  }

  return {
    type: 'FeatureCollection',
    features: trip.photoCoords.map((coord, index) => ({
      type: 'Feature',
      id: `${trip.key}-photo-${index}`,
      properties: {
        tripKey: trip.key,
      },
      geometry: {
        type: 'Point',
        coordinates: coord,
      },
    })),
  };
}

function toPaddingOptions(
  padding: SavedTripsMapViewportPadding | undefined,
): maplibregl.PaddingOptions {
  return padding ?? DEFAULT_PADDING;
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

function updateSelectedPhotoPoints(
  map: maplibregl.Map,
  trips: SavedTripPickable[],
  selectedKey: string | null,
) {
  const source = map.getSource(PHOTO_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (!source) return;
  source.setData(buildSelectedPhotoFeatureCollection(trips, selectedKey));
}

function fitAllTrips(
  map: maplibregl.Map,
  trips: SavedTripPickable[],
  padding: SavedTripsMapViewportPadding | undefined,
  duration = 0,
) {
  const bounds = new maplibregl.LngLatBounds();

  for (const trip of trips) {
    if (!trip.previewCoords?.length) continue;
    for (const coord of trip.previewCoords) {
      bounds.extend(coord as [number, number]);
    }
  }

  if (bounds.isEmpty()) return;

  map.fitBounds(bounds, {
    padding: toPaddingOptions(padding),
    maxZoom: INITIAL_FIT_MAX_ZOOM,
    duration,
  });
}

function focusTripRoute(
  map: maplibregl.Map,
  trips: SavedTripPickable[],
  tripKey: string,
  padding: SavedTripsMapViewportPadding | undefined,
) {
  const trip = trips.find((item) => item.key === tripKey);
  const coords = trip?.previewCoords;
  if (!coords?.length) return;

  const reduceMotion =
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  const duration = reduceMotion ? 0 : FOCUS_DURATION_MS;

  const bounds = new maplibregl.LngLatBounds();
  for (const coord of coords) bounds.extend(coord as [number, number]);

  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const spanLng = Math.abs(ne.lng - sw.lng);
  const spanLat = Math.abs(ne.lat - sw.lat);
  const isPointLike = spanLng < 1e-5 && spanLat < 1e-5;

  if (isPointLike || coords.length === 1) {
    map.easeTo({
      center: coords[0] as [number, number],
      zoom: POINT_FOCUS_ZOOM,
      padding: toPaddingOptions(padding),
      duration,
    });
    return;
  }

  map.fitBounds(bounds, {
    padding: toPaddingOptions(padding),
    maxZoom: FOCUS_MAX_ZOOM,
    duration,
  });
}

interface SavedTripsRoutesMapProps {
  trips: SavedTripPickable[];
  selectedKey: string | null;
  onRouteClick: (tripKey: string) => void;
  viewportPadding?: SavedTripsMapViewportPadding;
}

const SavedTripsRoutesMap = forwardRef<SavedTripsRoutesMapHandle, SavedTripsRoutesMapProps>(
  function SavedTripsRoutesMap({ trips, selectedKey, onRouteClick, viewportPadding }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const tripsRef = useRef(trips);
    const selectedKeyRef = useRef(selectedKey);
    const onRouteClickRef = useRef(onRouteClick);
    const viewportPaddingRef = useRef<SavedTripsMapViewportPadding | undefined>(viewportPadding);

    tripsRef.current = trips;
    selectedKeyRef.current = selectedKey;
    onRouteClickRef.current = onRouteClick;
    viewportPaddingRef.current = viewportPadding;

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
              focusTripRoute(map, tripsRef.current, tripKey, viewportPaddingRef.current);
            } catch {
              /* ignore */
            }
          });
        },
      }),
      [],
    );

    const featureCollection = buildFeatureCollection(trips);
    const hasLines = featureCollection.features.length > 0;

    useEffect(() => {
      if (!containerRef.current || !hasLines) return;

      const initialCollection = buildFeatureCollection(trips);
      const center: [number, number] =
        initialCollection.features[0]?.geometry.type === 'LineString'
          ? (initialCollection.features[0].geometry.coordinates[0] as [number, number])
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
          data: initialCollection,
        });

        map.addSource(PHOTO_SOURCE_ID, {
          type: 'geojson',
          data: buildSelectedPhotoFeatureCollection(tripsRef.current, selectedKeyRef.current),
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

        map.addLayer({
          id: PHOTO_HALO_LAYER_ID,
          type: 'circle',
          source: PHOTO_SOURCE_ID,
          paint: {
            'circle-color': '#f97316',
            'circle-opacity': 0.22,
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10,
              10,
              14,
              14,
            ],
          },
        });

        map.addLayer({
          id: PHOTO_LAYER_ID,
          type: 'circle',
          source: PHOTO_SOURCE_ID,
          paint: {
            'circle-color': '#f97316',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1.5,
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10,
              4,
              14,
              6,
            ],
          },
        });

        fitAllTrips(map, tripsRef.current, viewportPaddingRef.current);
        applyLineSelection(map, selectedKeyRef.current);
        updateSelectedPhotoPoints(map, tripsRef.current, selectedKeyRef.current);

        if (selectedKeyRef.current) {
          requestAnimationFrame(() => {
            try {
              map.stop();
              focusTripRoute(map, tripsRef.current, selectedKeyRef.current!, viewportPaddingRef.current);
            } catch {
              /* ignore */
            }
          });
        }

        const handleClick = (event: maplibregl.MapLayerMouseEvent) => {
          const features = map.queryRenderedFeatures(event.point, { layers: [HIT_LAYER_ID] });
          const tripKey = features[0]?.properties?.tripKey;
          if (typeof tripKey !== 'string') return;
          onRouteClickRef.current(tripKey);
        };

        map.on('click', HIT_LAYER_ID, handleClick);
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
      const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      if (source) source.setData(buildFeatureCollection(trips));
      updateSelectedPhotoPoints(map, trips, selectedKeyRef.current);
    }, [trips]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map?.isStyleLoaded()) return;
      applyLineSelection(map, selectedKey);
      updateSelectedPhotoPoints(map, tripsRef.current, selectedKey);
    }, [selectedKey]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map?.isStyleLoaded()) return;

      const timeoutId = window.setTimeout(() => {
        try {
          map.stop();
          map.resize();
          if (selectedKeyRef.current) {
            focusTripRoute(map, tripsRef.current, selectedKeyRef.current, viewportPaddingRef.current);
          } else {
            fitAllTrips(map, tripsRef.current, viewportPaddingRef.current);
          }
        } catch {
          /* ignore */
        }
      }, RESIZE_REFRAME_DEBOUNCE_MS);

      return () => window.clearTimeout(timeoutId);
    }, [viewportPadding]);

    if (!hasLines) return null;

    return <div ref={containerRef} className="saved-trips-routes-map" />;
  },
);

export default SavedTripsRoutesMap;

