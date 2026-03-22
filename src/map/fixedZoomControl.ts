import type { IControl, Map } from 'maplibre-gl';

/**
 * MapLibre 기본 NavigationControl은 `zoom === getMaxZoom()` 으로 + 버튼을 끄는데,
 * 부동소수점·fitBounds로 줌이 최대에 가깝게 잡히면 +가 항상 비활성처럼 보이는 문제가 있다.
 * `>= max - ε`, `<= min + ε` 로 판별한다.
 */
const ZOOM_BTN_EPS = 1e-3;

export class FixedZoomControl implements IControl {
  _map!: Map;
  _container!: HTMLDivElement;
  _zoomIn!: HTMLButtonElement;
  _zoomOut!: HTMLButtonElement;
  _onZoom = (): void => this._updateButtons();

  onAdd(map: Map): HTMLElement {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    this._container.addEventListener('contextmenu', (e) => e.preventDefault());

    this._zoomIn = document.createElement('button');
    this._zoomIn.type = 'button';
    this._zoomIn.className = 'maplibregl-ctrl-zoom-in';
    this._zoomIn.title = '확대';
    this._zoomIn.setAttribute('aria-label', '확대');
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
    this._zoomOut.title = '축소';
    this._zoomOut.setAttribute('aria-label', '축소');
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
