import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { subscribeMapPaneSize } from '../stores/replayMapPaneStore';
import { buildPhotoGroupMarkerFeatures } from '../utils/photoMapFeatures';
import {
  PHOTO_PIN_EXIF_ID,
  PHOTO_PIN_INTERP_ID,
  registerPhotoPinImages,
} from '../utils/photoMapPinImages';
import { FixedZoomControl } from '../map/fixedZoomControl';
import type { TrackPoint, PhotoGroup } from '../types';

const PHOTO_PIN_LAYER_ID = 'photo-groups-pins';

interface MapViewProps {
  track: TrackPoint[];
  groups: PhotoGroup[];
  currentPosition: { lat: number; lon: number } | null;
  onGroupClick?: (groupIndex: number) => void;
  /** 우측 사진 패널이 열릴 때 지도 리사이즈 및 마커가 보이도록 이동 */
  photoPanelOpen?: boolean;
  /** 재생바 사진 틱 클릭 등 — 해당 그룹 마커 좌표로 지도 중앙 이동 (seq가 바뀔 때마다 실행) */
  panToGroupMarker?: { groupIndex: number; seq: number } | null;
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * OSM 소스는 z17까지만 네이티브 타일을 쓰고, 그보다 높은 줌은 z17 타일을 확대(overzoom).
 * 주의: 레이어에 maxzoom을 17로 두면 MapLibre 규칙(zoom >= maxzoom 이면 레이어 숨김) 때문에
 * 줌 17·18에서 래스터가 아예 안 보인다 → 레이어 maxzoom은 두지 않는다.
 */
const NATIVE_OSM_MAX_ZOOM = 17;
const MAP_MAX_ZOOM = 18;

/** 타일 매니저와 무관하게 상시 표기 (소스 attribution은 중복 방지로 생략 가능) */
const MAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors | <a href="https://maplibre.org/" target="_blank" rel="noreferrer">MapLibre</a>';

const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export default function MapView({
  track,
  groups,
  currentPosition,
  onGroupClick,
  photoPanelOpen = false,
  panToGroupMarker = null,
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

    /** 기본 NavigationControl 줌은 zoom===max 엄격 비교로 +가 잘못 비고정됨 → FixedZoomControl 사용 */
    map.addControl(new FixedZoomControl(), 'top-right');
    map.addControl(
      new maplibregl.NavigationControl({ showZoom: false, showCompass: true }),
      'top-right',
    );

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
        /** 첫 화면이 지도 maxZoom에 딱 맞으면 +가 바로 쓸모없어지므로 한 단계 여유 */
        map.fitBounds(bounds, { padding: 60, maxZoom: Math.max(4, Math.min(NATIVE_OSM_MAX_ZOOM, MAP_MAX_ZOOM - 1)) });
      }

      const wirePhotoPinInteractions = () => {
        map.on('click', PHOTO_PIN_LAYER_ID, (e) => {
          const f = e.features?.[0];
          if (!f || !f.properties) return;
          const idx = f.properties['groupIndex'];
          if (typeof idx === 'number') {
            onGroupClickRef.current?.(idx);
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

        /** 사진 핀보다 위에 그려지도록 현재 위치 레이어를 맨 위로 */
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

  /** 재생바 주황 틱 클릭: 해당 사진 그룹 마커가 지도 영역 중앙에 오도록 */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || !panToGroupMarker) return;
    const g = groups[panToGroupMarker.groupIndex];
    if (!g) return;
    map.easeTo({
      center: [g.lon, g.lat],
      duration: 450,
      essential: true,
    });
  }, [panToGroupMarker, groups, styleReady]);

  return <div ref={containerRef} className="map-container" />;
}
