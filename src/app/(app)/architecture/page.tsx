import { Badge, Panel, Table, Td, Th } from "@/components/ui";

export const metadata = { title: "Architecture — Sentinel IVMAP" };

const LAYERS = [
  {
    name: "Departmental CCTV / VMS",
    detail: "26 departments, heterogeneous: analog + IP, local NVR / DVR / cloud, 7–90 day retention, 12 VMS vendors.",
    tone: "neutral" as const,
    owned: "Owned and operated by each department — untouched by Sentinel",
  },
  {
    name: "Adapter layer",
    detail: "Generic RTSP/ONVIF adapter plus per-vendor SDK plugins. Registers capability + heartbeat on start.",
    tone: "signal" as const,
    owned: "Model 3 · one adapter per department/vendor/protocol",
  },
  {
    name: "Federation middleware",
    detail: "Session brokering per department, protocol normalization, stream relay/transcode to WebRTC/HLS, event publishing.",
    tone: "signal" as const,
    owned: "Model 3 · the only component that talks to source systems",
  },
  {
    name: "Event & metadata bus",
    detail: "Topics: camera.health · detection.anpr · detection.object · detection.person · watchlist.match · alert.raised · adapter.health.",
    tone: "accent" as const,
    owned: "Kafka in production, in-process bus in this demo",
  },
  {
    name: "Central registry (PostgreSQL + PostGIS)",
    detail: "Camera metadata, ownership, GIS geometry, health history, onboarding audit trail. Source of truth for what exists.",
    tone: "accent" as const,
    owned: "Model 1 · the layer federation depends on to know what to connect to",
  },
  {
    name: "AI analytics pipeline",
    detail: "ANPR (detector + plate OCR), object/person detection, cross-camera correlation. GPU worker pool, edge-capable.",
    tone: "info" as const,
    owned: "Consumes frames, publishes detections",
  },
  {
    name: "Watchlist correlation engine",
    detail: "Continuous cross-referencing of every detection against the watchlist store; publishes watchlist.match on hit.",
    tone: "warn" as const,
    owned: "Vehicles by plate, persons by face embedding (pgvector)",
  },
  {
    name: "Alerting & notification",
    detail: "Severity by watchlist category, evidence attached (frame, camera, time, confidence), pushed to the dashboard.",
    tone: "alarm" as const,
    owned: "Real-time delivery over SSE/WebSocket",
  },
  {
    name: "Unified dashboard",
    detail: "Video wall, GIS map, alert queue, vehicle trace, registry admin, adapter console, gap analysis, audit.",
    tone: "neutral" as const,
    owned: "One operational picture across all departments, RBAC-scoped",
  },
];

export default function ArchitecturePage() {
  return (
    <div className="space-y-3">
      <Panel
        title="Why a hybrid of Reference Model 1 and Reference Model 3"
        subtitle="The choice is driven by what already exists in the field, not by what is easiest to draw"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 text-[12px] leading-relaxed text-mist-300">
            <p>
              <strong className="text-mist-100">Model 4 (single central VMS)</strong> would mean replacing 26 working
              systems across roughly 1,000 km. It is the most expensive option and it contradicts the brief's own
              instruction to use existing infrastructure to the maximum practical extent.
            </p>
            <p>
              <strong className="text-mist-100">Model 1 alone</strong> gives asset visibility but no live correlation and
              no alerting, so it cannot satisfy the mandatory watchlist requirement.
            </p>
            <p>
              <strong className="text-mist-100">Model 2 alone</strong> connects the viewing layer directly to every
              department's system. That is N×M integrations that must be rebuilt every time a department changes vendor.
            </p>
            <p>
              <strong className="text-saffron-300">Model 3 federation</strong> gives each department exactly one adapter
              to write, and decouples the platform from every vendor. Layering the{" "}
              <strong className="text-saffron-300">Model 1 registry</strong> underneath gives the federation layer the
              thing it needs to function — an authoritative list of what exists, where it is, who owns it and how it is
              reached — plus the gap analysis and onboarding governance the registry model was designed for.
            </p>
          </div>
          <div className="space-y-2">
            {[
              ["Registry is the map", "Federation cannot connect to a camera nobody has recorded. Model 1 is the prerequisite, not a parallel feature."],
              ["Adapters absorb vendor churn", "A department switching from Hikvision to Genetec replaces one adapter. Nothing above it changes."],
              ["Source systems stay authoritative", "Each department keeps its own storage and retention policy. Sentinel relays and analyses; it does not seize custody of footage."],
              ["Scales by partition, not by rewrite", "Adapters scale per department, the bus partitions by region, inference moves to the edge. None of that changes the contracts."],
            ].map(([t, d]) => (
              <div key={t} className="rounded border border-ink-700 bg-ink-900/50 px-3 py-2">
                <div className="text-[11.5px] font-medium text-saffron-300">{t}</div>
                <div className="mt-0.5 text-[11px] text-mist-400">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Layered architecture" subtitle="Data flows top to bottom; each layer only knows the contract of the one below">
        <ol className="space-y-1.5">
          {LAYERS.map((l, i) => (
            <li key={l.name} className="flex items-stretch gap-2">
              <div className="flex w-6 shrink-0 flex-col items-center">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-ink-600 bg-ink-800 font-mono text-[10px] text-mist-400">
                  {i + 1}
                </span>
                {i < LAYERS.length - 1 && <span className="w-px flex-1 bg-ink-600" />}
              </div>
              <div className="flex-1 rounded border border-ink-700 bg-ink-900/50 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-medium text-mist-100">{l.name}</span>
                  <Badge tone={l.tone}>{l.owned}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-mist-400">{l.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="What is real in this build, and what is simulated" subtitle="Stated plainly, because a demo that blurs this is not evidence of anything">
          <Table>
            <thead>
              <tr>
                <Th>Component</Th>
                <Th>In this build</Th>
                <Th>In production</Th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Registry, GIS, RBAC, audit", "Fully implemented", "Same code on PostgreSQL + PostGIS"],
                ["Adapter interface", "Implemented — RTSP/ONVIF probe does a real TCP connect", "Same interface, plus licensed vendor SDK bridges"],
                ["Event bus", "In-process, same topics and contract", "Kafka, partitioned by department/region"],
                ["ANPR / detection", "Simulated source behind the DetectionSource interface", "YOLO-class detector + plate OCR on GPU workers"],
                ["Camera video", "Synthetic canvas tiles, labelled SIMULATED", "HLS/WebRTC relayed by the federation layer"],
                ["Watchlist correlation", "Fully implemented, runs on every detection", "Identical, against VAHAN/eGujCop-sourced records"],
                ["Alerting + evidence", "Fully implemented", "Identical, with real frame captures"],
                ["Trace reconstruction", "Fully implemented, including plausibility checks", "Identical"],
              ].map(([c, d, p]) => (
                <tr key={c}>
                  <Td className="text-mist-100">{c}</Td>
                  <Td className="text-mist-300">{d}</Td>
                  <Td className="text-mist-400">{p}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-2 text-[10.5px] text-mist-400">
            The simulated detection source implements the same <code className="text-signal-400">DetectionSource</code>{" "}
            interface a real ANPR worker would. Correlation, alerting, trace, reporting and the audit trail consume its
            output through the bus and cannot tell the difference — which is the point: replacing it changes one file.
          </p>
        </Panel>

        <div className="space-y-3">
          <Panel title="Scaling to ~80,000 cameras" subtitle="Where each layer grows, and what breaks first">
            <Table>
              <thead>
                <tr>
                  <Th>Layer</Th>
                  <Th>Strategy</Th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Adapters", "Stateless workers, horizontally scaled per department/region; autoscale on stream count"],
                  ["Federation middleware", "Kubernetes microservices with HPA; regional relay nodes near the cameras"],
                  ["Event bus", "Kafka partitioned by department/region key; consumer groups per analytic"],
                  ["AI inference", "GPU pool centrally, edge inference at district level where bandwidth is the constraint"],
                  ["Bandwidth", "Edge sends metadata + thumbnails by default; full-resolution clips pulled only on alert"],
                  ["Storage", "Hot (recent clips, object store) → warm (90-day metadata) → cold archive; registry on PostGIS with read replicas"],
                  ["Database", "Detections partitioned by time and camera; PostGIS spatial index for map and gap queries"],
                ].map(([l, s]) => (
                  <tr key={l}>
                    <Td className="text-mist-100">{l}</Td>
                    <Td className="text-mist-300">{s}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="mt-2 text-[10.5px] text-mist-400">
              The first thing to break at scale is backbone bandwidth, not compute — which is why the design pushes
              inference toward the edge and moves metadata rather than video by default.
            </p>
          </Panel>

          <Panel title="Security posture" subtitle="What is enforced in this build">
            <ul className="space-y-1.5 text-[11.5px] text-mist-300">
              {[
                ["Signed sessions", "Session cookies are HMAC-signed and httpOnly, so role or department cannot be forged client-side."],
                ["Server-side RBAC", "Capability checks and department scoping run in one guard used by every API route — including the live event stream, which filters before writing to the socket rather than trusting the browser to hide rows."],
                ["No secrets in app state", "Adapter credentials are vault references. A raw secret posted to the adapter API is rejected."],
                ["Hash-chained audit", "Every entry hashes its predecessor; the audit page reports the first break if one exists."],
                ["No central footage custody", "Only detection metadata and short evidence references are held centrally. Full video stays with the owning department under its own retention policy."],
                ["Synthetic data only", "No production PII, no live watchlist records, no real departmental credentials in this repository."],
              ].map(([t, d]) => (
                <li key={t} className="rounded border border-ink-700 bg-ink-900/50 px-2.5 py-1.5">
                  <span className="font-medium text-mist-100">{t}. </span>
                  <span className="text-mist-400">{d}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel title="Integration readiness" subtitle="What plugs in next, and where">
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {[
            ["VAHAN / SARTHI", "Vehicle registration and licensing lookups as a watchlist source, through the same adapter shape the cameras use."],
            ["eGujCop / CCTNS", "FIR-linked stolen and suspect vehicle records, replacing the synthetic watchlist rows."],
            ["AFIS / NAFIS", "Biometric identification for the facial-recognition stretch capability."],
            ["Departmental VMS", "Any vendor: implement VmsAdapter — testConnection, normalizeHealth, streamUrl — and it federates."],
            ["State SSO", "Replaces the demo session module; the getSession() contract stays the same."],
            ["Dial 112 / control room CAD", "Alert dispatch actions can raise an incident directly rather than staying inside Sentinel."],
          ].map(([t, d]) => (
            <div key={t} className="rounded border border-ink-700 bg-ink-900/50 px-3 py-2">
              <div className="text-[11.5px] font-medium text-saffron-300">{t}</div>
              <div className="mt-0.5 text-[11px] text-mist-400">{d}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
