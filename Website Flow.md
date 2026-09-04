# Application Flow
## Sentinel — Integrated Video Management & Analytics Platform

---

## 1. User Roles → Entry Points

| Role | Landing after login |
|---|---|
| Control Room Operator | Unified Dashboard (video wall + alert queue) |
| Investigating Officer | Vehicle/Person Search |
| Watchlist Administrator | Watchlist Management |
| Department Admin | Department Camera & Adapter Console |
| Platform Admin | System/Adapter Health + Registry Admin |

All roles authenticate via a common login (RBAC-scoped session); department admins are scoped to their own department's data only.

---

## 2. Flow A — Camera Onboarding (Department Admin)

1. Login → Department Console.
2. Choose onboarding method: **Bulk upload** (CSV/Excel) / **Manual entry** / **API-based**.
3. Enter/verify metadata: location (lat/long or map-pick), camera type, vendor, protocol (RTSP/ONVIF/SDK), storage type, retention period.
4. System validates connectivity — pings adapter test connection to the camera/VMS endpoint.
5. On success → camera status = "Onboarded / Online"; registered in Central Registry; adapter starts publishing health + stream availability to the event bus.
6. On failure → status = "Onboarded / Unreachable", flagged in Gap-Analysis report; admin can retry or edit credentials.
7. Camera now appears on GIS map and is available to Federation layer for streaming/analytics.

---

## 3. Flow B — Live Monitoring (Control Room Operator)

1. Login → Unified Dashboard (default: video wall of assigned/favorited cameras).
2. Operator searches/filters cameras (by department, region, status) via GIS map or list.
3. Selects camera(s) → added to grid view (multi-camera layout).
4. Live stream relayed through Federation Middleware (WebRTC/HLS) — source VMS untouched.
5. Alert queue panel (persistent sidebar) shows incoming `watchlist.match` alerts in real time (WebSocket push).
6. Operator clicks an alert → jumps to relevant camera feed + evidence snapshot (frame, timestamp, confidence, matched watchlist entry) → Acknowledge / Dispatch action logged to audit trail.

---

## 4. Flow C — Vehicle/Person Trace (Investigating Officer)

1. Login → Search module.
2. Enter vehicle registration number (or person identifier/photo for FRS stretch feature).
3. System queries `Detection` records across all federated cameras where plate/person matched.
4. Results: **timeline list** (camera, location, timestamp) + **map view** plotting route in chronological order (using Registry's camera lat/long).
5. Officer can play back the evidence clip/frame at each hit point, and export the route report (PDF/CSV) — satisfies "Expected Output: complete timestamped, location-wise movement history."

---

## 5. Flow D — Watchlist Correlation & Real-Time Alert (System, automatic)

1. AI Analytics Pipeline continuously processes onboarded live/recorded feeds → emits `detection.anpr` / `detection.object` / `detection.person` events to bus.
2. Watchlist Correlation Engine consumes detection events → checks against `WatchlistEntry` table (plate match / face-embedding similarity).
3. On match → publishes `watchlist.match` event with confidence score.
4. Alerting service creates `Alert` record (severity by category), pushes to Dashboard (Operator) via WebSocket and to Alert Queue.
5. Evidence (frame snapshot + short clip) stored with the alert for audit/investigation.

---

## 6. Flow E — Watchlist Management (Watchlist Administrator)

1. Login → Watchlist Management.
2. Add/edit/remove entries: vehicle (plate number, category e.g. stolen/blacklisted), person (name, photo for FRS, category e.g. wanted/missing).
3. Bulk import supported (CSV) for demo/representative datasets.
4. View match history / alert log tied to each watchlist entry.
5. (Future/integration-ready) — entries can instead be sourced live from VAHAN/SARTHI/eGujCop/AFIS/NAFIS via the same adapter interface pattern used for camera onboarding.

---

## 7. Flow F — Gap Analysis & Registry Reporting (Platform Admin)

1. Login → Registry Admin.
2. View GIS map layered by department/status/camera type.
3. Run Gap-Analysis report → uncovered zones, offline/degraded cameras, aging infrastructure (no health signal beyond threshold).
4. Export report (PDF/CSV) for planning/decision-making.

---

## 8. Flow G — Evaluation Test Scenario (Judges, via Resources page)

1. Register on hackathon site → Resources page unlocks after registration.
2. Access ~50 live government test camera feeds + credentials/details.
3. Team onboards all test cameras via Flow A.
4. Judges provide a designated vehicle registration number → team runs Flow C to trace it.
5. Judges observe live watchlist correlation via Flow D/B on the same feeds.
6. Team submits output report (detected plates + timestamps) per submission requirements.

---

## 9. End-to-End Sequence (system view)

```
Camera/VMS → Adapter → Federation Middleware → Event Bus
     → [AI Analytics: ANPR/detection] → Event Bus
     → Watchlist Correlation Engine → (match?) → Alert Service
     → Dashboard (WebSocket) → Operator action
     → Audit Log
```
