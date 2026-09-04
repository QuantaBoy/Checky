/** Geospatial helpers. Production uses PostGIS; these cover the demo's needs. */

const R_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export interface LatLng {
  lat: number;
  lng: number;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Initial bearing from a to b, degrees clockwise from north. */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function compass(deg: number): string {
  return COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

/**
 * Plausibility of a camera-to-camera transition.
 *
 * A route is only evidence if the vehicle could physically have made it. Anything
 * implying a speed above `maxKph` is surfaced to the investigating officer as a
 * flagged hop (cloned/duplicate plate, misread, or clock drift between departments)
 * instead of being silently drawn on the map.
 */
export function transitionCheck(
  from: { at: string; pos: LatLng },
  to: { at: string; pos: LatLng },
  maxKph = 140,
): { km: number; minutes: number; kph: number; plausible: boolean; reason?: string } {
  const km = haversineKm(from.pos, to.pos);
  const ms = new Date(to.at).getTime() - new Date(from.at).getTime();
  const minutes = ms / 60000;
  if (ms <= 0) {
    return {
      km,
      minutes,
      kph: Infinity,
      plausible: false,
      reason: "Non-monotonic timestamps — check NTP sync between source departments",
    };
  }
  const kph = km / (ms / 3_600_000);
  // Two cameras metres apart on the same junction produce huge apparent speeds
  // from sub-second gaps; treat sub-500 m hops as co-located, not impossible.
  if (km < 0.5) return { km, minutes, kph, plausible: true };
  if (kph > maxKph) {
    return {
      km,
      minutes,
      kph,
      plausible: false,
      reason: `Implies ${Math.round(kph)} km/h over ${km.toFixed(1)} km — possible cloned plate, OCR misread, or clock drift`,
    };
  }
  return { km, minutes, kph, plausible: true };
}

/** Bounding box centre + radius, for the gap-analysis coverage grid. */
export function centroid(points: LatLng[]): LatLng {
  if (!points.length) return { lat: 22.3, lng: 71.7 };
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}
