/**
 * Cross-camera movement reconstruction (FR12 / Flow C).
 *
 * Produces the "complete timestamped, location-wise movement history" the challenge
 * asks for, and — just as importantly — marks the hops that are not physically
 * possible instead of drawing them as fact. An investigator acting on a route needs
 * to know which leg implies 400 km/h before they act on it.
 */

import { haversineKm, transitionCheck } from "./geo";
import { normalizePlate, store } from "./store";
import type { Camera, Detection } from "./types";

export interface TraceHop {
  detectionId: string;
  cameraId: string;
  cameraName: string;
  site: string;
  district: string;
  deptId: string;
  deptName: string;
  lat: number;
  lng: number;
  timestamp: string;
  plateRead: string;
  /** True when the plate read differs from the query (OCR-tolerant match). */
  fuzzy: boolean;
  confidence: number;
  direction?: string;
  speedKph?: number;
  frameRef: string;
  vehicleType?: string;
  vehicleColor?: string;
  /** Leg from the previous hop. Null on the first hop. */
  leg: {
    km: number;
    minutes: number;
    impliedKph: number;
    plausible: boolean;
    reason?: string;
  } | null;
}

export interface TraceResult {
  query: string;
  fuzzy: boolean;
  from: string | null;
  to: string | null;
  hops: TraceHop[];
  summary: {
    hits: number;
    cameras: number;
    departments: number;
    districts: string[];
    totalKm: number;
    durationMinutes: number;
    firstSeen: string | null;
    lastSeen: string | null;
    flaggedLegs: number;
    watchlisted: boolean;
    watchlistCategory?: string;
  };
}

export function traceVehicle(opts: {
  plate: string;
  fuzzy?: boolean;
  from?: string | null;
  to?: string | null;
  /** RBAC scope — when set, only this department's cameras are visible. */
  deptId?: string | null;
}): TraceResult {
  const query = normalizePlate(opts.plate);
  const fromMs = opts.from ? new Date(opts.from).getTime() : null;
  const toMs = opts.to ? new Date(opts.to).getTime() : null;

  let dets: Detection[] = store.detectionsForPlate(query, Boolean(opts.fuzzy));
  dets = dets.filter((d) => {
    const t = new Date(d.timestamp).getTime();
    if (fromMs !== null && t < fromMs) return false;
    if (toMs !== null && t > toMs) return false;
    if (opts.deptId) {
      const cam = store.camera(d.cameraId);
      if (!cam || cam.deptId !== opts.deptId) return false;
    }
    return true;
  });
  dets.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const hops: TraceHop[] = [];
  let prev: { at: string; pos: { lat: number; lng: number } } | null = null;
  let totalKm = 0;
  let flagged = 0;

  for (const d of dets) {
    const cam = store.camera(d.cameraId);
    if (!cam) continue;
    const dept = store.data.departments.find((x) => x.id === cam.deptId);
    let leg: TraceHop["leg"] = null;
    if (prev) {
      const t = transitionCheck(prev, { at: d.timestamp, pos: cam });
      leg = {
        km: Number(t.km.toFixed(2)),
        minutes: Number(t.minutes.toFixed(1)),
        impliedKph: Number.isFinite(t.kph) ? Math.round(t.kph) : -1,
        plausible: t.plausible,
        reason: t.reason,
      };
      totalKm += t.km;
      if (!t.plausible) flagged += 1;
    }
    hops.push({
      detectionId: d.id,
      cameraId: cam.id,
      cameraName: cam.name,
      site: cam.site,
      district: cam.district,
      deptId: cam.deptId,
      deptName: dept?.shortName ?? cam.deptId,
      lat: cam.lat,
      lng: cam.lng,
      timestamp: d.timestamp,
      plateRead: d.value,
      fuzzy: normalizePlate(d.value) !== query,
      confidence: d.confidence,
      direction: d.direction,
      speedKph: d.speedKph,
      frameRef: d.frameRef,
      vehicleType: d.vehicleType,
      vehicleColor: d.vehicleColor,
      leg,
    });
    prev = { at: d.timestamp, pos: cam };
  }

  const wl = store.data.watchlist.find((w) => w.kind === "vehicle" && normalizePlate(w.value) === query);
  const first = hops[0]?.timestamp ?? null;
  const last = hops[hops.length - 1]?.timestamp ?? null;

  return {
    query: opts.plate.toUpperCase(),
    fuzzy: Boolean(opts.fuzzy),
    from: opts.from ?? null,
    to: opts.to ?? null,
    hops,
    summary: {
      hits: hops.length,
      cameras: new Set(hops.map((h) => h.cameraId)).size,
      departments: new Set(hops.map((h) => h.deptId)).size,
      districts: [...new Set(hops.map((h) => h.district))],
      totalKm: Number(totalKm.toFixed(1)),
      durationMinutes:
        first && last ? Number(((new Date(last).getTime() - new Date(first).getTime()) / 60000).toFixed(1)) : 0,
      firstSeen: first,
      lastSeen: last,
      flaggedLegs: flagged,
      watchlisted: Boolean(wl),
      watchlistCategory: wl?.category,
    },
  };
}

/**
 * Cameras a vehicle plausibly passes next, ranked by distance from its last hit.
 * Gives the control room somewhere to look rather than only a history.
 */
export function predictNext(trace: TraceResult, limit = 5): { camera: Camera; km: number }[] {
  const last = trace.hops[trace.hops.length - 1];
  if (!last) return [];
  return store.data.cameras
    .filter((c) => c.anprEnabled && c.id !== last.cameraId && c.status !== "offline" && c.status !== "unreachable")
    .map((c) => ({ camera: c, km: Number(haversineKm(last, c).toFixed(1)) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}
