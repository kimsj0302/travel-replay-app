import type { IControl, Map } from 'maplibre-gl';
import { translations, type Lang } from '../i18n/translations';

const ZOOM_BTN_EPS = 1e-3;
const STORAGE_KEY = 'travel-replay-lang';

function getLang(): Lang {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === 'en' || s === 'ko') return s;
  } catch { /* noop */ }
  return 'ko';
}

export class FixedZoomControl implements IControl {
  _map!: Map;
  _container!: HTMLDivElement;
  _zoomIn!: HTMLButtonElement;
  _zoomOut!: HTMLButtonElement;
  _onZoom = (): void => this._updateButtons();

  onAdd(map: Map): HTMLElement {
    const t = translations[getLang()];
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    this._container.addEventListener('contextmenu', (e) => e.preventDefault());

    this._zoomIn = document.createElement('button');
    this._zoomIn.type = 'button';
    this._zoomIn.className = 'maplibregl-ctrl-zoom-in';
    this._zoomIn.title = t.zoomIn;
    this._zoomIn.setAttribute('aria-label', t.zoomIn);
    const inIcon = document.createElement('span');
    inIcon.className = 'maplibregl-ctrl-icon';
    inIcon.setAttribute('aria-hidden', 'true');
    this._zoomIn.appendChild(inIcon);
    this._zoomIn.addEventListener('click', (e) => {
      map.zoomIn({}, { originalEvent: e });
    });

    this._zoomOut = document.createElement('button');
    this._zoomOut.type = 'button';
    this._zoomOut.className = 'maplibregl-ctrl-zoom-out';
    this._zoomOut.title = t.zoomOut;
    this._zoomOut.setAttribute('aria-label', t.zoomOut);
    const outIcon = document.createElement('span');
    outIcon.className = 'maplibregl-ctrl-icon';
    outIcon.setAttribute('aria-hidden', 'true');
    this._zoomOut.appendChild(outIcon);
    this._zoomOut.addEventListener('click', (e) => {
      map.zoomOut({}, { originalEvent: e });
    });

    this._container.appendChild(this._zoomIn);
    this._container.appendChild(this._zoomOut);

    map.on('zoom', this._onZoom);
    map.on('zoomend', this._onZoom);
    map.on('moveend', this._onZoom);
    this._updateButtons();

    return this._container;
  }

  _updateButtons(): void {
    const z = this._map.getZoom();
    const maxZ = this._map.getMaxZoom();
    const minZ = this._map.getMinZoom();
    const eps = ZOOM_BTN_EPS;
    this._zoomIn.disabled = z >= maxZ - eps;
    this._zoomOut.disabled = z <= minZ + eps;
    this._zoomIn.setAttribute('aria-disabled', String(this._zoomIn.disabled));
    this._zoomOut.setAttribute('aria-disabled', String(this._zoomOut.disabled));
  }

  onRemove(): void {
    this._map.off('zoom', this._onZoom);
    this._map.off('zoomend', this._onZoom);
    this._map.off('moveend', this._onZoom);
    this._container.remove();
  }
}
