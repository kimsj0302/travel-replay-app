import { useCallback, useId, useMemo, useRef, useState } from 'react';
import type { SavedTripPickable } from '../types/savedTripPicker';
import type { Translations } from '../i18n/translations';
import SavedTripsRoutesMap, { type SavedTripsRoutesMapHandle } from './SavedTripsRoutesMap';

interface TripPickerPanelProps {
  trips: SavedTripPickable[];
  webglSupported: boolean;
  t: Translations;
  /** Modal vs main: slightly different min-height for map */
  variant: 'main' | 'modal';
  /** Disable only the confirm button while JSON is loading */
  confirmDisabled?: boolean;
  onConfirmOpen: (trip: SavedTripPickable) => void;
}

export default function TripPickerPanel({
  trips,
  webglSupported,
  t,
  variant,
  confirmDisabled = false,
  onConfirmOpen,
}: TripPickerPanelProps) {
  const listGroupId = useId();
  const headingId = `${listGroupId}-heading`;
  const routesMapRef = useRef<SavedTripsRoutesMapHandle>(null);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selectedTrip = useMemo(
    () => (selectedKey ? (trips.find((x) => x.key === selectedKey) ?? null) : null),
    [selectedKey, trips],
  );

  const hasAnyPreview = useMemo(
    () => trips.some((x) => x.previewCoords && x.previewCoords.length > 0),
    [trips],
  );

  /** 지도·리스트 공통: state + imperative 카메라 (selectedKey 이펙트에만 의존하지 않음) */
  const selectTrip = useCallback((key: string) => {
    setSelectedKey(key);
    requestAnimationFrame(() => {
      try {
        routesMapRef.current?.frameToTrip(key);
      } catch {
        /* ignore */
      }
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selectedTrip) return;
    onConfirmOpen(selectedTrip);
  }, [onConfirmOpen, selectedTrip]);

  const rootClass =
    variant === 'modal' ? 'trip-picker-panel trip-picker-panel--modal' : 'trip-picker-panel trip-picker-panel--main';

  return (
    <div className={rootClass}>
      {webglSupported && hasAnyPreview && (
        <div className="trip-picker-panel__map-wrap">
          <SavedTripsRoutesMap
            ref={routesMapRef}
            trips={trips}
            selectedKey={selectedKey}
            onRouteClick={selectTrip}
          />
          <p className="trip-picker-panel__hint">{t.tripPickerMapHint}</p>
        </div>
      )}

      {webglSupported && !hasAnyPreview && (
        <p className="trip-picker-panel__hint trip-picker-panel__hint--solo">{t.tripPickerNoTrackHint}</p>
      )}

      {!webglSupported && (
        <p className="trip-picker-panel__hint trip-picker-panel__hint--solo">{t.tripPickerWebglListOnly}</p>
      )}

      <div className="trip-picker-list-section">
        <div className="trip-picker-list-section__label" id={headingId}>
          {t.savedTrips}
        </div>
        <ul className="trip-picker-list" role="list" aria-labelledby={headingId}>
          {trips.map((s) => {
            const selected = selectedKey === s.key;
            return (
              <li key={s.key} className="trip-picker-list__item">
                <button
                  type="button"
                  className={`trip-picker-list__btn${selected ? ' trip-picker-list__btn--selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => selectTrip(s.key)}
                >
                  <span className="trip-picker-list__title">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="trip-picker-panel__footer">
        <div className="trip-picker-panel__summary" aria-live="polite">
          {selectedTrip ? (
            <>
              <span className="trip-picker-panel__summary-label">{t.tripPickerSelectedLabel}</span>
              <span className="trip-picker-panel__summary-value">{selectedTrip.label}</span>
            </>
          ) : (
            <span className="trip-picker-panel__summary-placeholder">{t.tripPickerNoneSelected}</span>
          )}
        </div>
        <button
          type="button"
          className="btn-primary trip-picker-panel__confirm"
          disabled={!selectedTrip || confirmDisabled}
          onClick={handleConfirm}
          aria-label={t.tripPickerOpenTripAria}
        >
          {t.tripPickerOpenTrip}
        </button>
      </div>
    </div>
  );
}
