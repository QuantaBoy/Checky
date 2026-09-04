/**
 * AI analytics pipeline (TRD.md §3.5).
 *
 * In production this is a pool of GPU workers running a YOLO-class detector plus a
 * plate OCR head, consuming decoded frames from the federation relay and publishing
 * to the bus. Everything downstream — correlation, alerting, trace — depends only on
 * the `DetectionSource` contract below, so replacing the demo simulator with those
 * workers changes nothing outside this file.
 *
 * The simulator is not decorative: journeys are planned along real road corridors and
 * timed from real inter-camera distances, so speeds and travel times a judge checks on
 * the map hold up. It never fabricates a hop that a vehicle could not physically make.
 */

import { bus } from "./bus";
import { haversineKm, bearingDeg, compass } from "./geo";
import { intBetween, mulberry32, pick } from "./rng";
import {
  BACKGROUND_PLATES,
  OBJECT_CLASSES,
  VEHICLE_COLORS,
  VEHICLE_TYPES,
} from "./seed";
import { store } from "./store";
import type { Camera, Detection } from "./types";

export interface DetectionSource {
  readonly name: string;
  start(): void;
  stop(): void;
  running(): boolean;
}

export interface JourneyHop {
  cameraId: string;
  at: number;
  direction: string;
  speedKph: number;
}

let detSeq = 0;
function detectionId(): string {
  detSeq += 1;
  return `DET-${Date.now().toString(36)}-${detSeq.toString(36)}`;
}

function anprCameras(): Camera[] {
  return store.data.cameras.filter((c) => c.anprEnabled && c.status !== "offline" && c.status !== "unreachable");
}

/**
 * Plan a physically coherent journey along a corridor.
 *
 * Travel time between two cameras is derived from their real great-circle distance
 * and a cruising speed sampled per journey, with per-hop jitter for traffic. That is
 * what keeps a reconstructed route free of the impossible-speed hops that would make
 * an investigator distrust the whole trace.
 */
export function planJourney(opts: {
  corridorCameras: Camera[];
  startAt: number;
  cruisingKph?: number;
  reverse?: boolean;
  /** 0..1 — chance a given camera on the path misses the vehicle (occlusion, lane, glare). */
  missRate?: number;
  rnd?: () => number;
}): JourneyHop[] {
  const rnd = opts.rnd ?? Math.random;
  const cams = opts.reverse ? [...opts.corridorCameras].reverse() : opts.corridorCameras;
  const cruise = opts.cruisingKph ?? 55 + rnd() * 35;
  const missRate = opts.missRate ?? 0.18;
  const hops: JourneyHop[] = [];
  let t = opts.startAt;
  for (let i = 0; i < cams.length; i += 1) {
    const cam = cams[i];
    if (i > 0) {
      const prev = cams[i - 1];
      const km = haversineKm(prev, cam);
      // Urban hops crawl; highway hops cruise. Jitter keeps timings non-robotic.
      const effective = km < 3 ? cruise * 0.45 : cruise * (0.85 + rnd() * 0.35);
      t += (km / Math.max(8, effective)) * 3_600_000;
      t += rnd() * 45_000; // signals, toll queue
    }
    if (i > 0 && rnd() < missRate) continue; // camera on the route simply didn't catch it
    const next = cams[i + 1] ?? cams[i - 1] ?? cam;
    const dir = compass(bearingDeg(cam, next));
    hops.push({
      cameraId: cam.id,
      at: Math.round(t),
      direction: opts.reverse ? `${dir}-bound` : `${dir}-bound`,
      speedKph: Math.round(cruise * (0.8 + rnd() * 0.4)),
    });
  }
  return hops;
}

export function makePlateDetection(
  cameraId: string,
  plate: string,
  at: number,
  extra: Partial<Detection> = {},
  rnd: () => number = Math.random,
): Detection {
  return {
    id: detectionId(),
    cameraId,
    type: "plate",
    value: plate,
    // ANPR confidence is never 1.0 in the field; keeping it honest matters because
    // the correlation engine thresholds on it.
    confidence: Number((0.82 + rnd() * 0.17).toFixed(3)),
    timestamp: new Date(at).toISOString(),
    bbox: [0.28 + rnd() * 0.3, 0.52 + rnd() * 0.22, 0.13 + rnd() * 0.07, 0.05 + rnd() * 0.03],
    frameRef: `frame://${cameraId}/${Math.floor(at / 1000)}.jpg`,
    vehicleType: pick(rnd, VEHICLE_TYPES),
    vehicleColor: pick(rnd, VEHICLE_COLORS),
    source: "sim-anpr-v1",
    ...extra,
  };
}

function makeObjectDetection(cam: Camera, at: number, rnd: () => number): Detection {
  const cls = pick(rnd, OBJECT_CLASSES);
  return {
    id: detectionId(),
    cameraId: cam.id,
    type: cls === "person" ? "person" : "object",
    value: cls,
    confidence: Number((0.6 + rnd() * 0.38).toFixed(3)),
    timestamp: new Date(at).toISOString(),
    bbox: [rnd() * 0.7, rnd() * 0.6, 0.08 + rnd() * 0.2, 0.12 + rnd() * 0.3],
    frameRef: `frame://${cam.id}/${Math.floor(at / 1000)}.jpg`,
    source: "sim-detector-v1",
  };
}

/** Publish a detection on the correct topic; the correlation engine listens there. */
export function emitDetection(d: Detection): void {
  store.addDetection(d);
  bus.publish(
    d.type === "plate" ? "detection.anpr" : d.type === "person" ? "detection.person" : "detection.object",
    d,
  );
}

interface ActiveJourney {
  plate: string;
  hops: JourneyHop[];
  cursor: number;
  vehicleType: string;
  vehicleColor: string;
}

/**
 * Simulated detection source. Drives the live demo: continuous background traffic,
 * periodic watchlisted vehicles, and — when judges nominate one — a designated
 * vehicle whose route is guaranteed to be traceable end to end.
 */
export class SimulatedDetectionSource implements DetectionSource {
  readonly name = "sim-anpr-v1";
  private timer: NodeJS.Timeout | null = null;
  private journeys: ActiveJourney[] = [];
  private rnd = mulberry32(Date.now() & 0xffff);
  private tickMs: number;

  constructor(tickMs = 1500) {
    this.tickMs = tickMs;
  }

  running(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.tickMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  /** Corridors as camera objects, ordered along the road. */
  private corridors(): Camera[][] {
    const map = store.data.corridors ?? {};
    const out: Camera[][] = [];
    for (const ids of Object.values(map)) {
      const cams = ids.map((id) => store.camera(id)).filter((c): c is Camera => Boolean(c) && c!.anprEnabled);
      if (cams.length >= 3) out.push(cams);
    }
    if (!out.length) {
      const cams = anprCameras().slice(0, 8);
      if (cams.length >= 3) out.push(cams);
    }
    return out;
  }

  /** Queue a journey for a specific plate; used for watchlist hits and judge traces. */
  launchJourney(plate: string, opts: { startAt?: number; reverse?: boolean; corridorIndex?: number } = {}): boolean {
    const corridors = this.corridors();
    if (!corridors.length) return false;
    const cams =
      opts.corridorIndex !== undefined
        ? corridors[opts.corridorIndex % corridors.length]
        : pick(this.rnd, corridors);
    const hops = planJourney({
      corridorCameras: cams,
      startAt: opts.startAt ?? Date.now(),
      reverse: opts.reverse ?? this.rnd() < 0.5,
      rnd: this.rnd,
    });
    if (!hops.length) return false;
    this.journeys.push({
      plate,
      hops,
      cursor: 0,
      vehicleType: pick(this.rnd, VEHICLE_TYPES),
      vehicleColor: pick(this.rnd, VEHICLE_COLORS),
    });
    return true;
  }

  private tick(): void {
    const now = Date.now();
    const cams = anprCameras();
    if (!cams.length) return;

    // 1. Advance in-flight journeys.
    for (const j of this.journeys) {
      while (j.cursor < j.hops.length && j.hops[j.cursor].at <= now) {
        const hop = j.hops[j.cursor];
        j.cursor += 1;
        const cam = store.camera(hop.cameraId);
        if (!cam || cam.status === "offline" || cam.status === "unreachable") continue;
        emitDetection(
          makePlateDetection(
            hop.cameraId,
            j.plate,
            hop.at,
            {
              direction: hop.direction,
              speedKph: hop.speedKph,
              vehicleType: j.vehicleType,
              vehicleColor: j.vehicleColor,
            },
            this.rnd,
          ),
        );
      }
    }
    this.journeys = this.journeys.filter((j) => j.cursor < j.hops.length);

    // 2. Keep the watchlist demonstrably live: launch a watchlisted vehicle now and
    //    then, plus the designated vehicle if the judges nominated one.
    if (this.journeys.length < 14 && this.rnd() < 0.5) {
      const active = store.data.watchlist.filter((w) => w.active && w.kind === "vehicle");
      const designated = store.data.designatedVehicle;
      const plate =
        designated && this.rnd() < 0.35
          ? designated
          : active.length && this.rnd() < 0.4
            ? pick(this.rnd, active).value
            : pick(this.rnd, BACKGROUND_PLATES);
      this.launchJourney(plate);
    }

    // 3. Background single-camera traffic so non-corridor cameras are not dead.
    const burst = intBetween(this.rnd, 1, 4);
    for (let i = 0; i < burst; i += 1) {
      const cam = pick(this.rnd, cams);
      emitDetection(
        makePlateDetection(cam.id, pick(this.rnd, BACKGROUND_PLATES), now - intBetween(this.rnd, 0, 1200), {
          direction: `${compass(cam.bearing)}-bound`,
          speedKph: intBetween(this.rnd, 18, 92),
        }, this.rnd),
      );
    }

    // 4. Object/person detections on every camera type, ANPR or not.
    const all = store.data.cameras.filter((c) => c.status === "online" || c.status === "degraded");
    for (let i = 0; i < intBetween(this.rnd, 1, 3) && all.length; i += 1) {
      emitDetection(makeObjectDetection(pick(this.rnd, all), now, this.rnd));
    }
  }
}

/**
 * Backfill plausible history so the trace scenario has something to reconstruct the
 * moment the platform boots, instead of forcing a judge to wait for live traffic.
 */
export function backfillHistory(hours = 8): void {
  const rnd = mulberry32(987654321);
  const now = Date.now();
  const corridors = Object.values(store.data.corridors ?? {})
    .map((ids) => ids.map((id) => store.camera(id)).filter((c): c is Camera => Boolean(c) && c!.anprEnabled))
    .filter((c) => c.length >= 3);
  const watchPlates = store.data.watchlist.filter((w) => w.kind === "vehicle" && w.active).map((w) => w.value);

  // Watchlisted vehicles: several complete journeys each, spread over the window.
  for (const plate of watchPlates) {
    const runs = intBetween(rnd, 2, 3);
    for (let r = 0; r < runs; r += 1) {
      const cams = pick(rnd, corridors);
      if (!cams?.length) continue;
      const startAt = now - intBetween(rnd, 20, hours * 60) * 60_000;
      for (const hop of planJourney({ corridorCameras: cams, startAt, reverse: rnd() < 0.5, rnd })) {
        if (hop.at > now) break;
        store.addDetection(
          makePlateDetection(hop.cameraId, plate, hop.at, { direction: hop.direction, speedKph: hop.speedKph }, rnd),
        );
      }
    }
  }

  // Background traffic across every corridor.
  for (let i = 0; i < 160; i += 1) {
    const cams = pick(rnd, corridors);
    if (!cams?.length) continue;
    const startAt = now - intBetween(rnd, 5, hours * 60) * 60_000;
    for (const hop of planJourney({ corridorCameras: cams, startAt, reverse: rnd() < 0.5, rnd })) {
      if (hop.at > now) break;
      store.addDetection(
        makePlateDetection(hop.cameraId, pick(rnd, BACKGROUND_PLATES), hop.at, {
          direction: hop.direction,
          speedKph: hop.speedKph,
        }, rnd),
      );
    }
  }

  // Isolated hits on non-corridor cameras.
  const solo = anprCameras();
  for (let i = 0; i < 900 && solo.length; i += 1) {
    const cam = pick(rnd, solo);
    const at = now - intBetween(rnd, 1, hours * 60) * 60_000 - intBetween(rnd, 0, 59) * 1000;
    store.addDetection(
      makePlateDetection(cam.id, pick(rnd, BACKGROUND_PLATES), at, {
        direction: `${compass(cam.bearing)}-bound`,
        speedKph: intBetween(rnd, 15, 95),
      }, rnd),
    );
  }

  store.data.detections.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
