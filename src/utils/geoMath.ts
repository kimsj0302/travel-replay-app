/**
 * 지구상 거리·좌표 유틸 (수치 엄밀도)
 *
 * - ECMAScript `number`는 **IEEE 754 binary64**(배정밀도 부동소수점)입니다.
 *   float16(half)·float32(single) 타입은 언어에 없고, 여기서도 사용하지 않습니다.
 * - 구면 거리는 **Haversine** 공식을 **atan2** 형태로 계산해 `asin` 근처에서의
 *   수치 불안정을 줄입니다. (구체는 WGS84 **평균 반지름** 근사)
 *
 * @see WGS84 mean Earth radius (authalic sphere) ≈ 6371008.7714 m
 */

/** 배정밀도 실수 (JS `number` = IEEE 754 binary64) */
export type Float64 = number;

/** WGS84 구체 근사: authalic mean radius (m) — 구형 지구 Haversine에 사용 */
export const EARTH_RADIUS_METERS_WGS84_SPHERE = 6371008.7714 as const;

const DEG_TO_RAD = Math.PI / 180;

function toRad(deg: Float64): Float64 {
  return deg * DEG_TO_RAD;
}

/**
 * 두 위경도(도) 사이의 대원 거리 (m).
 * 구형 지구 + WGS84 평균 반지름 근사. 타원체 Vincenty 대비 빠르고, 수 km 이내·일반 여행 GPX에 충분.
 */
export function haversineMeters(
  lat1Deg: Float64,
  lon1Deg: Float64,
  lat2Deg: Float64,
  lon2Deg: Float64,
): Float64 {
  const φ1 = toRad(lat1Deg);
  const φ2 = toRad(lat2Deg);
  const Δφ = toRad(lat2Deg - lat1Deg);
  const Δλ = toRad(lon2Deg - lon1Deg);

  const sinΔφ2 = Math.sin(Δφ / 2);
  const sinΔλ2 = Math.sin(Δλ / 2);
  const a = sinΔφ2 * sinΔφ2 + Math.cos(φ1) * Math.cos(φ2) * sinΔλ2 * sinΔλ2;

  // a ∈ [0,1] 로 클램프 (부동소수점으로 1 초과 시 NaN 방지)
  const aClamp = Math.min(1, Math.max(0, a));

  const centralAngle = 2 * Math.atan2(Math.sqrt(aClamp), Math.sqrt(1 - aClamp));
  return EARTH_RADIUS_METERS_WGS84_SPHERE * centralAngle;
}
