/**
 * Watchlist correlation engine + alerting service (TRD.md §3.6, §3.7 / Flow D).
 *
 * Consumes `detection.*` off the bus, cross-references the watchlist, publishes
 * `watchlist.match`, and raises alerts with evidence attached. Runs continuously —
 * nothing here is triggered by a user action, which is what "continuous live-feed
 * cross-referencing" in the evaluation scenario means.
 */

import { bus } from "./bus";
import { normalizePlate, plateDistance, store } from "./store";
import type { Alert, Detection, WatchlistEntry } from "./types";

/** Below this the ANPR read is too weak to raise a critical alert on its own. */
const MIN_CONFIDENCE = 0.75;
/** Same plate, same camera, inside this window = one event, not many. */
const DEDUPE_MS = 90_000;

let alertSeq = 0;
const recent = new Map<string, number>();

function nextAlertId(): string {
  alertSeq += 1;
  return `ALR-${Date.now().toString(36)}-${alertSeq.toString(36)}`;
}

export interface MatchResult {
  entry: WatchlistEntry;
  confidence: number;
  exact: boolean;
}

/** Cosine similarity for the face-embedding (FRS) stretch path. */
function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/**
 * Match one detection against the active watchlist.
 *
 * Exact plate matches score at the detection's own confidence. Single-character
 * differences are reported as probable matches at reduced confidence rather than
 * discarded — a misread `0`/`O` on a stolen vehicle is worth an operator's eyes —
 * but they never inherit the full confidence of a clean read.
 */
export function matchDetection(d: Detection): MatchResult | null {
  const active = store.data.watchlist.filter((w) => w.active);
  if (d.type === "plate") {
    const key = normalizePlate(d.value);
    for (const w of active) {
      if (w.kind !== "vehicle") continue;
      if (normalizePlate(w.value) === key) {
        return { entry: w, confidence: d.confidence, exact: true };
      }
    }
    for (const w of active) {
      if (w.kind !== "vehicle") continue;
      if (plateDistance(normalizePlate(w.value), key) === 1) {
        return { entry: w, confidence: Number((d.confidence * 0.7).toFixed(3)), exact: false };
      }
    }
    return null;
  }
  if (d.type === "person" && d.embedding) {
    let best: MatchResult | null = null;
    for (const w of active) {
      if (w.kind !== "person" || !w.embedding) continue;
      const sim = cosine(w.embedding, d.embedding);
      if (sim > 0.86 && (!best || sim > best.confidence)) {
        best = { entry: w, confidence: Number(sim.toFixed(3)), exact: false };
      }
    }
    return best;
  }
  return null;
}

function raiseAlert(d: Detection, m: MatchResult): Alert | null {
  const dedupeKey = `${normalizePlate(d.value)}|${d.cameraId}|${m.entry.id}`;
  const seen = recent.get(dedupeKey);
  const at = new Date(d.timestamp).getTime();
  if (seen && at - seen < DEDUPE_MS) return null;
  recent.set(dedupeKey, at);
  if (recent.size > 4000) {
    for (const [k, v] of recent) if (at - v > DEDUPE_MS * 4) recent.delete(k);
  }

  const cam = store.camera(d.cameraId);
  if (!cam) return null;

  // A probable (fuzzy) match is downgraded one severity step: it still reaches the
  // operator, but it must not sit above a confirmed critical hit in the queue.
  const order: Alert["severity"][] = ["critical", "high", "medium", "low"];
  const base = order.indexOf(m.entry.severity);
  const severity = m.exact && m.confidence >= MIN_CONFIDENCE ? m.entry.severity : order[Math.min(order.length - 1, base + 1)];

  const alert: Alert = {
    id: nextAlertId(),
    detectionId: d.id,
    watchlistEntryId: m.entry.id,
    cameraId: d.cameraId,
    deptId: cam.deptId,
    severity,
    status: "new",
    confidence: m.confidence,
    createdAt: new Date().toISOString(),
    evidence: {
      frameRef: d.frameRef,
      plate: d.value,
      timestamp: d.timestamp,
      location: { lat: cam.lat, lng: cam.lng, site: cam.site },
    },
    note: m.exact ? undefined : `Probable match — ANPR read '${d.value}' differs from watchlist '${m.entry.value}' by one character`,
  };
  store.addAlert(alert);
  store.audit({
    actor: "correlation-engine",
    role: "system",
    action: "alert.raised",
    entity: "Alert",
    entityId: alert.id,
    detail: `${m.entry.category} ${m.entry.value} matched on ${cam.id} (${cam.site}) at confidence ${m.confidence}`,
  });
  bus.publish("alert.raised", alert);
  return alert;
}

export function processDetection(d: Detection): void {
  const m = matchDetection(d);
  if (!m) return;
  bus.publish("watchlist.match", { detection: d, entry: m.entry, confidence: m.confidence });
  raiseAlert(d, m);
}

let wired = false;

export function startCorrelationEngine(): void {
  if (wired) return;
  wired = true;
  bus.subscribe("detection.anpr", processDetection);
  bus.subscribe("detection.person", processDetection);
}

/** Re-run correlation over stored history — used after a watchlist entry is added. */
export function backfillCorrelation(entry: WatchlistEntry, sinceMs = 12 * 3600_000): number {
  const cutoff = Date.now() - sinceMs;
  let raised = 0;
  for (const d of store.data.detections) {
    if (new Date(d.timestamp).getTime() < cutoff) continue;
    if (d.type !== "plate" || entry.kind !== "vehicle") continue;
    if (normalizePlate(d.value) !== normalizePlate(entry.value)) continue;
    const alert = raiseAlert(d, { entry, confidence: d.confidence, exact: true });
    if (alert) raised += 1;
  }
  return raised;
}
