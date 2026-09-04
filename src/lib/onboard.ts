/**
 * Onboarding helpers shared by manual, API and CSV-bulk camera registration
 * (FR1 / Flow A). Keeping the adapter attachment in one place means every
 * onboarding path produces the same federation wiring.
 */

import { store } from "./store";
import type { Adapter, Camera } from "./types";

export function adapterKindFor(protocol: Camera["protocol"]): Adapter["kind"] {
  return protocol === "sdk" ? "vendor-sdk" : protocol === "hls" ? "hls-passthrough" : "rtsp-onvif";
}

/** Attach a camera to its department+vendor adapter, creating one if needed. */
export function attachToAdapter(cam: Camera): Adapter {
  const kind = adapterKindFor(cam.protocol);
  const existing = store.data.adapters.find(
    (a) => a.deptId === cam.deptId && a.vendor === cam.vendor && a.kind === kind,
  );
  if (existing) {
    if (!existing.cameraIds.includes(cam.id)) existing.cameraIds.push(cam.id);
    return existing;
  }
  const dept = store.data.departments.find((d) => d.id === cam.deptId);
  const nums = store.data.adapters.map((a) => Number(/(\d+)$/.exec(a.id)?.[1] ?? 0));
  const adapter: Adapter = {
    id: `ADP-${String(Math.max(0, ...nums) + 1).padStart(3, "0")}`,
    name: `${dept?.shortName ?? cam.deptId} · ${cam.vendor}`,
    kind,
    deptId: cam.deptId,
    vendor: cam.vendor,
    cameraIds: [cam.id],
    credentialsRef: `vault://gujarat/sentinel/${cam.deptId.toLowerCase()}/${cam.vendor.split(" ")[0].toLowerCase()}#v1`,
    health: cam.status === "online" ? "healthy" : "unconfigured",
    lastHeartbeat: cam.lastHeartbeat,
    latencyMs: 0,
    eventsPublished: 0,
    rawSample: "(no payload observed yet)",
    version: "1.0.0",
  };
  store.data.adapters.push(adapter);
  return adapter;
}

export const CAMERA_TYPES = ["fixed", "dome", "bullet", "ptz", "anpr", "thermal"] as const;
export const PROTOCOLS = ["rtsp", "onvif", "sdk", "hls"] as const;
export const STORAGE_TYPES = ["local_nvr", "cloud", "hybrid", "dvr"] as const;
