/**
 * In-memory data store with JSON snapshotting.
 *
 * Production target is PostgreSQL + PostGIS (TRD.md §3.4). Everything above this
 * module talks to `store` only, so the swap is contained here. Detections are held
 * in a bounded ring so a long-running demo cannot exhaust memory.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  Adapter,
  Alert,
  AuditLog,
  Camera,
  Detection,
  Department,
  Role,
  User,
  WatchlistEntry,
} from "./types";

const MAX_DETECTIONS = 30000;
const MAX_ALERTS = 5000;
const MAX_AUDIT = 10000;
const SNAPSHOT_PATH = path.join(process.cwd(), "data", "snapshot.json");

export interface StoreData {
  departments: Department[];
  cameras: Camera[];
  adapters: Adapter[];
  detections: Detection[];
  watchlist: WatchlistEntry[];
  alerts: Alert[];
  audit: AuditLog[];
  users: User[];
  /** Corridor id → camera ids in travel order. Drives physically coherent routing. */
  corridors: Record<string, string[]>;
  /** Vehicle registration the judges nominate for the trace scenario. */
  designatedVehicle: string | null;
  bootedAt: string;
  seeded: boolean;
}

export class Store {
  data: StoreData = {
    departments: [],
    cameras: [],
    adapters: [],
    detections: [],
    watchlist: [],
    alerts: [],
    audit: [],
    users: [],
    corridors: {},
    designatedVehicle: null,
    bootedAt: new Date().toISOString(),
    seeded: false,
  };

  private detectionsByPlate = new Map<string, Detection[]>();
  private snapshotTimer: NodeJS.Timeout | null = null;

  // ── cameras ──────────────────────────────────────────────────────────────
  camera(id: string): Camera | undefined {
    return this.data.cameras.find((c) => c.id === id);
  }

  addCamera(c: Camera): Camera {
    this.data.cameras.push(c);
    return c;
  }

  updateCamera(id: string, patch: Partial<Camera>): Camera | undefined {
    const c = this.camera(id);
    if (!c) return undefined;
    Object.assign(c, patch);
    return c;
  }

  removeCamera(id: string): boolean {
    const i = this.data.cameras.findIndex((c) => c.id === id);
    if (i < 0) return false;
    this.data.cameras.splice(i, 1);
    for (const a of this.data.adapters) a.cameraIds = a.cameraIds.filter((x) => x !== id);
    return true;
  }

  nextCameraId(): string {
    const nums = this.data.cameras
      .map((c) => Number(/(\d+)$/.exec(c.id)?.[1] ?? 0))
      .filter((n) => Number.isFinite(n));
    return `CAM-${String(Math.max(0, ...nums) + 1).padStart(3, "0")}`;
  }

  // ── detections ───────────────────────────────────────────────────────────
  addDetection(d: Detection): Detection {
    this.data.detections.push(d);
    if (d.type === "plate") {
      const key = normalizePlate(d.value);
      const arr = this.detectionsByPlate.get(key) ?? [];
      arr.push(d);
      this.detectionsByPlate.set(key, arr);
    }
    if (this.data.detections.length > MAX_DETECTIONS) {
      const dropped = this.data.detections.splice(0, this.data.detections.length - MAX_DETECTIONS);
      for (const d2 of dropped) {
        if (d2.type !== "plate") continue;
        const key = normalizePlate(d2.value);
        const arr = this.detectionsByPlate.get(key);
        if (!arr) continue;
        const i = arr.indexOf(d2);
        if (i >= 0) arr.splice(i, 1);
        if (!arr.length) this.detectionsByPlate.delete(key);
      }
    }
    return d;
  }

  /** Exact and fuzzy plate lookup. Fuzzy covers OCR-confusable characters. */
  detectionsForPlate(plate: string, fuzzy = false): Detection[] {
    const key = normalizePlate(plate);
    const exact = this.detectionsByPlate.get(key) ?? [];
    if (!fuzzy) return [...exact];
    const out = new Map<string, Detection>();
    for (const d of exact) out.set(d.id, d);
    for (const [k, arr] of this.detectionsByPlate) {
      if (k === key) continue;
      if (plateDistance(k, key) <= 1) for (const d of arr) out.set(d.id, d);
    }
    return [...out.values()];
  }

  // ── watchlist ────────────────────────────────────────────────────────────
  watchlistEntry(id: string): WatchlistEntry | undefined {
    return this.data.watchlist.find((w) => w.id === id);
  }

  nextWatchlistId(): string {
    const nums = this.data.watchlist.map((w) => Number(/(\d+)$/.exec(w.id)?.[1] ?? 0));
    return `WL-${String(Math.max(0, ...nums) + 1).padStart(3, "0")}`;
  }

  // ── alerts ───────────────────────────────────────────────────────────────
  addAlert(a: Alert): Alert {
    this.data.alerts.unshift(a);
    if (this.data.alerts.length > MAX_ALERTS) this.data.alerts.length = MAX_ALERTS;
    return a;
  }

  alert(id: string): Alert | undefined {
    return this.data.alerts.find((a) => a.id === id);
  }

  // ── audit (hash-chained) ─────────────────────────────────────────────────
  /**
   * Append-only audit log. Each entry hashes the previous entry's hash together
   * with its own canonical form, so deleting or back-dating a row breaks the chain
   * and `verifyAuditChain()` reports the first bad sequence number.
   */
  audit(entry: {
    actor: string;
    role: Role | "system";
    action: string;
    entity: string;
    entityId: string;
    detail: string;
  }): AuditLog {
    const prev = this.data.audit[this.data.audit.length - 1];
    const seq = (prev?.seq ?? 0) + 1;
    const timestamp = new Date().toISOString();
    const prevHash = prev?.hash ?? "GENESIS";
    const row: AuditLog = {
      id: `AUD-${seq}`,
      seq,
      ...entry,
      timestamp,
      prevHash,
      hash: "",
    };
    row.hash = auditHash(row);
    this.data.audit.push(row);
    if (this.data.audit.length > MAX_AUDIT) this.data.audit.splice(0, this.data.audit.length - MAX_AUDIT);
    return row;
  }

  verifyAuditChain(): { valid: boolean; checked: number; brokenAtSeq?: number } {
    let prevHash = this.data.audit[0]?.prevHash ?? "GENESIS";
    for (const row of this.data.audit) {
      if (row.prevHash !== prevHash || row.hash !== auditHash(row)) {
        return { valid: false, checked: this.data.audit.length, brokenAtSeq: row.seq };
      }
      prevHash = row.hash;
    }
    return { valid: true, checked: this.data.audit.length };
  }

  // ── snapshot ─────────────────────────────────────────────────────────────
  /**
   * Config-and-evidence snapshot only. Raw detection history is intentionally
   * capped in the file so a long demo does not write hundreds of MB to disk.
   */
  snapshot(): void {
    try {
      fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
      const payload = {
        ...this.data,
        detections: this.data.detections.slice(-4000),
        users: undefined, // demo credentials stay in code, never in the snapshot
      };
      fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(payload, null, 1));
    } catch (err) {
      console.error("[store] snapshot failed:", err);
    }
  }

  startSnapshots(everyMs = 60_000): void {
    if (this.snapshotTimer) return;
    this.snapshotTimer = setInterval(() => this.snapshot(), everyMs);
    this.snapshotTimer.unref?.();
  }
}

function auditHash(row: AuditLog): string {
  const canonical = [
    row.seq,
    row.actor,
    row.role,
    row.action,
    row.entity,
    row.entityId,
    row.detail,
    row.timestamp,
    row.prevHash,
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

export function normalizePlate(p: string): string {
  return p.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Levenshtein distance, capped — used for OCR-tolerant plate matching. */
export function plateDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    const cur = [i];
    for (let j = 1; j <= n; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

const g = globalThis as typeof globalThis & { __sentinelStore?: Store };
export const store: Store = g.__sentinelStore ?? (g.__sentinelStore = new Store());
