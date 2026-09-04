/**
 * Sentinel IVMAP — core domain types.
 *
 * These mirror the entity model in TRD.md §4. Every layer (adapters, event bus,
 * analytics, correlation, API) speaks in these types, so replacing the demo
 * in-memory store with PostgreSQL/PostGIS is a store-layer change only.
 */

export type Role =
  | "operator"
  | "investigator"
  | "watchlist_admin"
  | "dept_admin"
  | "platform_admin";

export type CameraStatus = "online" | "offline" | "degraded" | "unreachable";

export type CameraType = "fixed" | "ptz" | "anpr" | "dome" | "bullet" | "thermal";

export type Protocol = "rtsp" | "onvif" | "sdk" | "hls";

export type StorageType = "local_nvr" | "cloud" | "hybrid" | "dvr";

export interface Department {
  id: string;
  name: string;
  shortName: string;
  district: string;
  nodalOfficer: string;
  vmsVendor: string;
  contact: string;
}

export interface Camera {
  id: string;
  name: string;
  deptId: string;
  lat: number;
  lng: number;
  district: string;
  site: string;
  type: CameraType;
  vendor: string;
  model: string;
  analog: boolean;
  protocol: Protocol;
  endpoint: string;
  /** Optional real HLS/MJPEG URL. When absent the UI renders the simulated feed. */
  streamUrl?: string;
  storageType: StorageType;
  retentionDays: number;
  status: CameraStatus;
  /** Bearing the camera faces, degrees clockwise from north. Used for direction-of-travel. */
  bearing: number;
  fovDeg: number;
  installedAt: string;
  onboardedAt: string;
  lastHeartbeat: string | null;
  anprEnabled: boolean;
  notes?: string;
}

export type AdapterKind = "rtsp-onvif" | "vendor-sdk" | "hls-passthrough" | "mock";

export type AdapterHealth = "healthy" | "degraded" | "down" | "unconfigured";

export interface Adapter {
  id: string;
  name: string;
  kind: AdapterKind;
  deptId: string;
  vendor: string;
  /** Cameras this adapter fronts. */
  cameraIds: string[];
  /** Reference to a secret in the vault — never the secret itself. */
  credentialsRef: string;
  health: AdapterHealth;
  lastHeartbeat: string | null;
  latencyMs: number;
  eventsPublished: number;
  /**
   * A sample of the vendor's own payload shape before normalization. Shown in the
   * adapter console as proof that federation actually translates heterogeneous
   * schemas rather than assuming one.
   */
  rawSample: string;
  version: string;
}

export type DetectionType = "plate" | "person" | "object";

export interface Detection {
  id: string;
  cameraId: string;
  type: DetectionType;
  /** Plate number, person label, or object class. */
  value: string;
  confidence: number;
  timestamp: string;
  /** Direction of travel inferred from track vector across the camera FOV. */
  direction?: string;
  speedKph?: number;
  /** Normalized bounding box within the frame, [x, y, w, h] in 0..1. */
  bbox?: [number, number, number, number];
  frameRef: string;
  vehicleType?: string;
  vehicleColor?: string;
  /** Face embedding for the FRS stretch path (FR13). Present on person detections only. */
  embedding?: number[];
  /** Which detection source produced this: the simulator or a real ANPR worker. */
  source: string;
}

export type WatchlistCategory =
  | "stolen_vehicle"
  | "blacklisted_vehicle"
  | "wanted_person"
  | "missing_person"
  | "suspect_vehicle";

export type WatchlistSeverity = "critical" | "high" | "medium" | "low";

export interface WatchlistEntry {
  id: string;
  kind: "vehicle" | "person";
  category: WatchlistCategory;
  /** Plate number (vehicles) or person name (persons). */
  value: string;
  description: string;
  severity: WatchlistSeverity;
  /** Originating record system — VAHAN / eGujCop / CCTNS / manual. */
  source: string;
  caseRef: string;
  addedBy: string;
  addedAt: string;
  active: boolean;
  /** Face embedding placeholder for the FRS stretch capability. */
  embedding?: number[];
}

export type AlertStatus = "new" | "acknowledged" | "dispatched" | "closed";

export interface Alert {
  id: string;
  detectionId: string;
  watchlistEntryId: string;
  cameraId: string;
  deptId: string;
  severity: WatchlistSeverity;
  status: AlertStatus;
  confidence: number;
  createdAt: string;
  handledBy?: string;
  handledAt?: string;
  note?: string;
  evidence: {
    frameRef: string;
    plate: string;
    timestamp: string;
    location: { lat: number; lng: number; site: string };
  };
}

export interface AuditLog {
  id: string;
  seq: number;
  actor: string;
  role: Role | "system";
  action: string;
  entity: string;
  entityId: string;
  detail: string;
  timestamp: string;
  /** SHA-256 over (prevHash + canonical entry). Makes back-dating detectable. */
  hash: string;
  prevHash: string;
}

export interface User {
  id: string;
  username: string;
  /** Demo credentials only — no production secrets live in this repo. */
  password: string;
  name: string;
  role: Role;
  /** Non-null only for dept_admin: the single department they may see. */
  deptId: string | null;
  designation: string;
}

export interface Session {
  userId: string;
  username: string;
  name: string;
  role: Role;
  deptId: string | null;
  designation: string;
  issuedAt: number;
}

/** Topics carried on the event bus. Names match TRD.md §3.3. */
export interface BusEvents {
  "camera.health": { cameraId: string; status: CameraStatus; deptId: string; at: string };
  "detection.anpr": Detection;
  "detection.object": Detection;
  "detection.person": Detection;
  "watchlist.match": {
    detection: Detection;
    entry: WatchlistEntry;
    confidence: number;
  };
  "alert.raised": Alert;
  "alert.updated": Alert;
  "adapter.health": { adapterId: string; health: AdapterHealth; deptId: string; at: string };
}

export type BusTopic = keyof BusEvents;
