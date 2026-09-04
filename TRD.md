# Technical Requirements Document (TRD) / High-Level Design
## Sentinel — Integrated Video Management & Analytics Platform

---

## 1. Architecture Principles

Open, modular, scalable, secure, standards-based, vendor-neutral. No component is hard-wired to a single vendor's SDK — all vendor-specific code lives behind an **adapter interface**, so cameras/VMS/analytics/storage can be swapped without redesigning the core.

## 2. High-Level Architecture

```
Departmental CCTV / VMS Systems (26 depts, heterogeneous)
        │  RTSP / ONVIF / Vendor SDK / API
        ▼
┌─────────────────────────────────────────────┐
│  Adapter Layer (per-vendor connectors)       │
│  RTSP-ONVIF generic adapter | vendor plugins │
└─────────────────────────────────────────────┘
        │  normalized stream + metadata
        ▼
┌─────────────────────────────────────────────┐
│  Federation Middleware                       │
│  - Auth & session mgmt   - Protocol translate│
│  - Stream relay/transcode - Event bus (Kafka)│
└─────────────────────────────────────────────┘
        │                         │
        ▼                         ▼
┌────────────────────┐   ┌──────────────────────────┐
│ Central Registry    │   │ AI Analytics Pipeline     │
│ (Model 1: metadata, │   │ ANPR · detection · track  │
│ GIS, PostGIS)        │   │ cross-camera correlation  │
└────────────────────┘   └──────────────────────────┘
        │                         │
        └───────────┬─────────────┘
                     ▼
        ┌─────────────────────────────┐
        │ Watchlist Correlation Engine │
        │ (stream detections ↔ DB)     │
        └─────────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────────┐
        │ Alerting & Notification      │
        └─────────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────────┐
        │ Unified Dashboard (Web)      │
        │ Video wall · GIS map ·       │
        │ Alerts · Vehicle trace ·     │
        │ Registry admin               │
        └─────────────────────────────┘
```

## 3. Component Breakdown

### 3.1 Adapter Layer
- Generic RTSP/ONVIF adapter (covers majority of IP cameras/NVRs) — primary build target.
- Vendor-SDK adapter plugin interface (extensible, onboard specific vendors as needed).
- Adapter registers itself with Federation Middleware on startup; reports camera capability + health heartbeat.

### 3.2 Federation Middleware
- **Responsibilities:** authentication/session brokering per department, protocol normalization, stream relay/transcode (to WebRTC/HLS for browser playback), event bus publishing.
- **Tech:** Node.js or Java (Spring Boot) services; Kong/NGINX as API gateway; Redis for session/cache.

### 3.3 Event & Metadata Bus
- **Tech:** Kafka (or RabbitMQ for lower-scale demo) — topics per event type: `camera.health`, `detection.anpr`, `detection.object`, `watchlist.match`, `alert.raised`.
- Decouples producers (adapters, AI pipeline) from consumers (correlation engine, dashboard, registry).

### 3.4 Central Registry (Model 1)
- **Tech:** PostgreSQL + PostGIS, React.js admin UI, Leaflet/OpenLayers for GIS map.
- Stores camera metadata (location, department, type, vendor, storage, retention, status), ownership, onboarding audit trail.
- Exposes REST API consumed by Federation layer (source of truth for "what cameras exist") and by GIS dashboard.

### 3.5 AI Analytics Pipeline
- **ANPR:** open-source/custom OCR+detection model (e.g., YOLO-class detector + plate OCR), GPU-accelerated inference.
- **Object/vehicle/person detection:** standard detector (YOLOv8-class) per frame/stream.
- **Cross-camera correlation:** matches plate/vehicle signature + timestamp + camera geo-location across events on the bus to reconstruct a route (ordered by timestamp, joined via registry's camera lat/long).
- **Stretch:** Facial recognition against watchlist photo set.
- **Tech:** Python microservices (FastAPI), Kafka consumer, GPU inference (CUDA), model serving via Triton/TorchServe if time allows, else direct in-process inference.

### 3.6 Watchlist Correlation Engine
- Consumes `detection.*` topics, queries watchlist store (plate numbers, wanted-person face embeddings) in near-real-time, publishes `watchlist.match` on hit.
- **Tech:** Python/Node service, PostgreSQL for structured watchlist (vehicles/persons), optional vector store (e.g., pgvector) for face-embedding similarity search.
- **Future integration-readiness:** designed with an adapter interface identical in shape to VMS adapters, so VAHAN/SARTHI/eGujCop/AFIS/NAFIS can be plugged in as watchlist data sources without re-architecture — for the demo, a representative/synthetic watchlist DB is used.

### 3.7 Alerting
- On `watchlist.match`, generate prioritized alert (severity by watchlist category), push to dashboard via WebSocket, log to audit trail with evidence (frame snapshot, camera ID, timestamp, confidence).

### 3.8 Unified Dashboard (Frontend)
- **Tech:** React.js SPA.
- Modules: Live video wall/grid, GIS registry map, alert queue, vehicle-trace search & timeline/map view, department admin (RBAC-scoped), adapter/camera health monitoring.

## 4. Data Model (core entities)

- `Camera` (id, dept_id, lat, long, type, vendor, ip/analog, storage_type, retention_days, status, onboarded_at)
- `Department` (id, name, RBAC scope)
- `Adapter` (id, camera_id, protocol, credentials_ref, health_status)
- `Detection` (id, camera_id, type[plate/person/object], value, confidence, frame_ref, timestamp)
- `WatchlistEntry` (id, category[vehicle/person], value/embedding, source, added_at)
- `Alert` (id, detection_id, watchlist_entry_id, severity, status[new/ack/dispatched], created_at)
- `AuditLog` (id, actor, action, entity, timestamp)

## 5. Security

- TLS for all feed exchange and API traffic; encrypted credential storage for department adapter secrets (vault/KMS).
- Department-wise RBAC — admins scoped to own department; command-centre roles cross-department read + alert-action.
- Network segmentation between adapter layer (touches department networks) and core platform.
- Full audit trail: onboarding, access, alert actions.
- No raw video centrally stored by default (federation model relays, doesn't mandate central long-term storage) — only detection metadata + short evidence clips retained centrally, honoring each department's own retention policy for full footage.

## 6. Scalability (path to ~80,000 cameras)

| Layer | Scaling strategy |
|---|---|
| Adapter layer | Horizontally scaled adapter workers per department/region; stateless, auto-scaled |
| Federation middleware | Kubernetes-orchestrated microservices, horizontal pod autoscaling |
| Event bus | Kafka partitioned by department/region topic keys |
| AI inference | GPU worker pool, edge-inference option at district level to cut backbone bandwidth (only send metadata + alert-triggering clips centrally, not raw streams) |
| Storage | Tiered: hot (recent detections/clips, object storage), warm (30–90 day metadata), cold (archival, glacier-class); registry metadata in PostgreSQL/PostGIS with read replicas |
| Compute topology | Central (correlation/registry/dashboard) + Regional (transcode/relay) + Edge (per-site inference where feasible) to manage the ~1,000 km geographic spread and bandwidth limits |
| Network | Low-bandwidth strategy: edge sends detection metadata + thumbnails by default, full-res clip pulled on demand/alert only |

## 7. Deployment & Ops

- **Orchestration:** Kubernetes.
- **Observability:** centralized logging (ELK/Loki), metrics (Prometheus/Grafana), adapter/camera health checks feeding the Registry status field.
- **HA/DR:** multi-AZ/region deployment for core services; Kafka replication; database backups + standby replica; documented RTO/RPO.
- **CI/CD:** standard pipeline for microservices; adapter plugins independently deployable.

## 8. Suggested Technology Stack (summary)

| Layer | Stack |
|---|---|
| Frontend | React.js |
| Backend/middleware | Node.js, Python (FastAPI) |
| Messaging | Kafka (or RabbitMQ) |
| API Gateway | Kong / NGINX |
| Database | PostgreSQL + PostGIS, Redis (cache/session) |
| AI/ML | YOLO-class detection, ANPR OCR, GPU inference |
| GIS | Leaflet / OpenLayers |
| Streaming | RTSP/ONVIF ingestion, WebRTC/HLS relay for browser playback |
| Orchestration | Kubernetes |
| Storage | S3-compatible object storage (tiered) |

## 9. Prerequisites / Info Needed from Departments (for real deployment)

- Camera/VMS inventory with protocol capability (RTSP/ONVIF/SDK availability).
- Network reachability/firewall rules to reach adapter layer.
- Existing storage/retention policy per department.
- Nominated department admin/IT contact for adapter credential provisioning.
