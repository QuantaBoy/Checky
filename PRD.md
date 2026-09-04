# Product Requirements Document (PRD)
## Sentinel — Integrated Video Management & Analytics Platform
### Gujarat Police Innovation Challenge 2026

---

## 1. Overview

**Product name:** Sentinel Integrated Video Management & Analytics Platform (Sentinel IVMAP)

**Chosen approach:** Hybrid Architecture — **Model 1 (Centralised CCTV Registry & GIS Mapping)** as the foundational asset-visibility layer, combined with **Model 3 (VMS Federation & Middleware Integration)** as the live integration and analytics layer.

**Why hybrid, not a single model:**
- 26 departments run heterogeneous, independently-owned CCTV/VMS systems (different vendors, retention periods, storage types, protocols) across sites up to ~1,000 km apart. Ripping and replacing this with a single Central VMS (Model 4) is costly, disruptive, and contradicts the brief's core goal of using existing infrastructure "to the maximum practical extent."
- A registry-only approach (Model 1 alone) gives visibility but no live correlation, alerting, or analytics — it cannot satisfy the mandatory watchlist-correlation and real-time-alert requirement.
- A pure viewing layer (Model 2) connects directly to every department's system, which does not scale cleanly to 80,000 cameras across 26+ owners and creates N-squared integration complexity as departments change vendors.
- **Federation middleware (Model 3)** gives each department a single adapter to write once, decouples the platform from any one VMS vendor, and is the standard pattern for large multi-agency video interoperability (comparable to how national ANPR/interop networks are built elsewhere). Layering the **Model 1 registry** underneath gives asset visibility, gap analysis, and onboarding governance that the federation layer depends on to know what exists and where.
- This combination directly satisfies the "Permitted Approach" clause allowing hybrids of two or more reference models and is explicitly eligible for bonus evaluation points ("Innovative hybrid or customised architecture with clear operational value").

---

## 2. Problem Statement

26 Gujarat Government departments operate independent, non-interoperable CCTV ecosystems (analog + IP, cloud + local storage, 7–15+ day retention, multiple vendors) spread across the state. There is no unified way to:
1. Know what cameras exist, where, and in what condition (asset visibility gap).
2. View and analyze feeds across departments in one place.
3. Correlate live video with law-enforcement watchlists (stolen vehicles, wanted/missing persons) to generate real-time alerts.
4. Trace a vehicle's or person's movement across the integrated camera network over time.

## 3. Goals

| # | Goal | Success Metric |
|---|------|-----------------|
| G1 | Unified asset registry of all onboarded public-domain cameras | 100% of test cameras (~50) onboarded with complete metadata |
| G2 | Federated live/near-live access to heterogeneous VMS feeds without disturbing source systems | ≥2 distinct department system types integrated via adapters in demo |
| G3 | Real-time watchlist correlation & alerting | Alert generated within seconds of a watchlist match on live/recorded feed |
| G4 | Cross-camera vehicle movement tracing | Full timestamped route reconstruction for a designated vehicle across all camera hits |
| G5 | Statewide scalability posture | Documented, credible scaling path to ~80,000 cameras |
| G6 | Security & standards compliance | RBAC, encrypted feed exchange, audit trail, no vendor lock-in |

## 4. Non-Goals (out of scope for this submission)

- Replacing or migrating existing departmental VMS/storage systems.
- Centralized long-term (>90 day) video archival of all 80,000 camera feeds.
- Integration with private/commercial CCTV beyond a "where feasible/permitted" opt-in viewing capability (not mandatory for evaluation).
- Full production-grade FRS (Facial Recognition System) — included as a stretch/bonus capability only, not core evaluation path.

## 5. Users & Personas

| Persona | Role | Needs |
|---|---|---|
| **Control Room Operator** | State/district command centre staff | Live multi-camera grid, alert queue, quick camera search |
| **Investigating Officer** | Police officer tracing a suspect/vehicle | Vehicle/person search, route reconstruction, evidence export |
| **Watchlist Administrator** | State Crime Records Bureau staff | Manage watchlist entries (vehicles, persons), review match logs |
| **Department Admin (26 depts)** | IT/nodal officer per department | Onboard own cameras/VMS, manage adapter credentials, view own department's data only (RBAC scoped) |
| **System/Platform Admin** | Sentinel platform team | Manage adapters, health monitoring, user/role management, gap-analysis reports |
| **Evaluation Committee** (demo-specific) | Hackathon judges | Access Resources page, view live test feeds, run vehicle-trace test scenario |

## 6. Core Features (Functional Requirements)

### 6.1 Registry & GIS Layer (Model 1 foundation)
- FR1: Bulk (CSV/Excel), manual, and API-based camera onboarding with metadata schema (location/lat-long, department, camera type, vendor, IP/analog, storage type, retention period, connectivity status, ownership).
- FR2: Interactive GIS map with layered filters (department, camera type, status, coverage).
- FR3: Camera health/maintenance-status monitoring (online/offline/degraded).
- FR4: Gap-analysis reporting — uncovered zones, aging/EOL infrastructure.
- FR5: Role-based search, filter, export, and full metadata audit trail.

### 6.2 Federation & Live Integration Layer (Model 3)
- FR6: Adapter/connector framework supporting RTSP, ONVIF, vendor SDKs/APIs — pluggable per VMS vendor.
- FR7: Metadata & event exchange bus (pub/sub) carrying camera events, detections, and health signals across systems.
- FR8: Cross-system event correlation engine (same vehicle/person seen across different departmental systems within a time/geo window).
- FR9: Unified operational dashboard — video wall, multi-camera grid, alert feed — sourced from federated adapters, independent of source VMS UI.

### 6.3 AI Analytics
- FR10: ANPR (Automatic Number Plate Recognition) on onboarded feeds, mandatory for evaluation.
- FR11: Object/vehicle/person detection and event tagging.
- FR12: Cross-camera vehicle movement tracking → timestamped, geo-located route reconstruction ("Expected Output" requirement).
- FR13 (bonus/stretch): Facial recognition matching against watchlist photos.

### 6.4 Watchlist & Alerting
- FR14: Watchlist database (stolen vehicles, wanted/missing persons, blacklisted vehicles) — representative dataset for demo; designed for future integration readiness with VAHAN, SARTHI, eGujCop, AFIS, NAFIS.
- FR15: Continuous cross-referencing of live/ingested detections against watchlist.
- FR16: Real-time alert generation on match — prioritized, visualized, actionable (acknowledge/dispatch) in operator dashboard.
- FR17: Alert & match audit log with evidence snapshot (frame, timestamp, camera, confidence score).

### 6.5 Platform / Admin
- FR18: Department-wise RBAC — department admins see/manage only their own cameras and adapters; command-centre roles see cross-department federated view.
- FR19: Adapter/connector health monitoring and credential management.
- FR20: API documentation for registry and federation layer (integration-readiness for future onboarding).

## 7. Test-Scenario Alignment (must-pass for evaluation)

1. Onboard ~50 heterogeneous government-provided cameras onto the platform via Registry + Federation adapters.
2. Given a designated vehicle registration number, identify and trace it across the network with full timestamped, location-wise route.
3. Demonstrate continuous live-feed cross-referencing against a representative watchlist with automated real-time alert generation.
4. Produce an output report of detected vehicles/plates with timestamps for the government-provided feed.

## 8. Submission Deliverables Mapping

| Requirement | Produced by |
|---|---|
| Solution Presentation (PPT/PDF) | Derived from this PRD + TRD summary |
| High-Level Design (HLD) | TRD.md |
| Own-feed demo (2–3 min) | Working prototype (out of scope of these docs) |
| Government-feed live demo | Working prototype |
| Submission links | YouTube (unlisted) / Drive / hosted URL + repo link |

## 9. Timeline (per official schedule)

- Registration opened: Aug 4, 2026
- Submission deadline: **Sep 7, 2026**
- Hackathon event: Sep 10–11, 2026
- Results: Sep 11, 2026

## 10. Risks & Assumptions

- **Assumption:** Government-provided test feeds expose at least RTSP/ONVIF or a vendor SDK/API — federation adapters assume one of these exists per camera/system.
- **Risk:** Heterogeneity of the 50 test cameras may exceed adapter coverage built in hackathon timeframe → mitigate by building a generic RTSP/ONVIF adapter first (covers majority of IP cameras), vendor-specific adapters only as time allows.
- **Risk:** Watchlist DB is representative/mock, not live eGujCop/CCTNS — acceptable per rules, but TRD must show the integration-readiness path.
- **Assumption:** No real PII/production watchlist data used in demo — synthetic data only.
