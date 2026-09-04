/**
 * Platform boot + runtime wiring.
 *
 * One call, idempotent, invoked by any route that touches the store. Seeds the
 * registry, wires the correlation engine to the bus, starts the detection source and
 * the adapter/camera heartbeats. Pinned to globalThis so Next's dev reload does not
 * start a second copy of every timer.
 */

import { SimulatedDetectionSource, backfillHistory } from "./analytics";
import { backfillCorrelation, startCorrelationEngine } from "./correlation";
import { bus } from "./bus";
import { intBetween, mulberry32, pick } from "./rng";
import { DEPARTMENTS, USERS, WATCHLIST, buildAdapters, buildCameras, buildCorridors } from "./seed";
import { store } from "./store";
import type { CameraStatus } from "./types";

export interface Engine {
  source: SimulatedDetectionSource;
  heartbeat: NodeJS.Timeout | null;
  startedAt: string;
}

const g = globalThis as typeof globalThis & { __sentinelEngine?: Engine };

function seed(): void {
  if (store.data.seeded) return;
  const cameras = buildCameras();
  store.data.departments = DEPARTMENTS;
  store.data.cameras = cameras;
  store.data.corridors = buildCorridors(cameras);
  store.data.adapters = buildAdapters(cameras);
  store.data.watchlist = [...WATCHLIST];
  store.data.users = USERS;
  store.data.designatedVehicle = null;
  store.data.bootedAt = new Date().toISOString();
  store.data.seeded = true;

  store.audit({
    actor: "system",
    role: "system",
    action: "platform.boot",
    entity: "Platform",
    entityId: "sentinel",
    detail: `Seeded ${cameras.length} cameras across ${DEPARTMENTS.length} departments, ${store.data.adapters.length} federation adapters, ${WATCHLIST.length} watchlist entries`,
  });

  backfillHistory(8);
  // History predates the correlation engine subscribing to the bus, so replay it —
  // otherwise the alert queue would be empty until live traffic caught up.
  for (const w of store.data.watchlist) {
    if (w.active && w.kind === "vehicle") backfillCorrelation(w, 8 * 3600_000);
  }
}

/**
 * Camera and adapter heartbeats. Statuses drift a little over time so the health
 * monitoring, gap analysis and adapter console are showing live state rather than a
 * frozen table.
 */
function startHeartbeats(): NodeJS.Timeout {
  const rnd = mulberry32(31337);
  const t = setInterval(() => {
    const now = new Date().toISOString();
    for (const cam of store.data.cameras) {
      if (cam.status === "online" || cam.status === "degraded") {
        cam.lastHeartbeat = now;
      }
      // Occasional flap, weighted heavily toward staying healthy.
      if (rnd() < 0.01) {
        const next: CameraStatus =
          cam.status === "online"
            ? pick(rnd, ["online", "online", "degraded"] as CameraStatus[])
            : cam.status === "degraded"
              ? pick(rnd, ["online", "degraded", "offline"] as CameraStatus[])
              : pick(rnd, ["offline", "online"] as CameraStatus[]);
        if (next !== cam.status) {
          cam.status = next;
          bus.publish("camera.health", { cameraId: cam.id, status: next, deptId: cam.deptId, at: now });
        }
      }
    }
    for (const a of store.data.adapters) {
      const cams = a.cameraIds.map((id) => store.camera(id)).filter(Boolean);
      const up = cams.filter((c) => c!.status === "online").length;
      const health = up === 0 ? "down" : up < cams.length ? "degraded" : "healthy";
      a.latencyMs = Math.max(12, a.latencyMs + intBetween(rnd, -25, 25));
      a.eventsPublished += intBetween(rnd, 0, 40);
      if (health !== a.health) {
        a.health = health;
        bus.publish("adapter.health", { adapterId: a.id, health, deptId: a.deptId, at: now });
      }
      a.lastHeartbeat = health === "down" ? a.lastHeartbeat : now;
    }
  }, 5000);
  t.unref?.();
  return t;
}

export function ensureBooted(): Engine {
  if (g.__sentinelEngine) return g.__sentinelEngine;
  seed();
  startCorrelationEngine();
  const source = new SimulatedDetectionSource(1500);
  source.start();
  store.startSnapshots(60_000);
  const engine: Engine = { source, heartbeat: startHeartbeats(), startedAt: new Date().toISOString() };
  g.__sentinelEngine = engine;
  return engine;
}

export function engine(): Engine {
  return ensureBooted();
}
