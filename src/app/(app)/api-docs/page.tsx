import { Badge, Panel, Table, Td, Th } from "@/components/ui";

export const metadata = { title: "API reference — Sentinel IVMAP" };

interface Endpoint {
  method: string;
  path: string;
  cap: string;
  summary: string;
  params?: string;
  sample?: string;
}

const GROUPS: { name: string; note: string; endpoints: Endpoint[] }[] = [
  {
    name: "Authentication",
    note: "Session is an HMAC-signed httpOnly cookie. Every other endpoint requires it.",
    endpoints: [
      { method: "POST", path: "/api/auth/login", cap: "—", summary: "Sign in; sets the session cookie and returns the role's landing page.", sample: `{ "username": "operator", "password": "sentinel" }` },
      { method: "POST", path: "/api/auth/logout", cap: "—", summary: "Clear the session; logged to the audit trail." },
      { method: "GET", path: "/api/auth/session", cap: "—", summary: "Current session and its capability list." },
    ],
  },
  {
    name: "Registry (Model 1)",
    note: "Department admins are scoped server-side: they see and modify only their own department's cameras.",
    endpoints: [
      { method: "GET", path: "/api/cameras", cap: "camera.read", summary: "List cameras with filters.", params: "dept, status, type, district, anpr, q" },
      { method: "POST", path: "/api/cameras", cap: "camera.write", summary: "Onboard one camera; probes the endpoint through its adapter before accepting.", sample: `{ "name": "CAM-AMD-11", "deptId": "D02", "lat": 23.02, "lng": 72.57,\n  "protocol": "onvif", "endpoint": "rtsp://10.22.14.5:554/stream1",\n  "anprEnabled": true, "retentionDays": 30 }` },
      { method: "GET", path: "/api/cameras/{id}", cap: "camera.read", summary: "One camera with its department, adapter, recent detections and alerts." },
      { method: "PATCH", path: "/api/cameras/{id}", cap: "camera.write", summary: "Update camera metadata. deptId is immutable — moving a camera between departments would move it out of its owner's scope." },
      { method: "DELETE", path: "/api/cameras/{id}", cap: "camera.delete", summary: "Decommission a camera; recorded in the audit trail." },
      { method: "POST", path: "/api/cameras/{id}/test", cap: "camera.write", summary: "Re-probe through the adapter. ?live=true forces a real TCP probe instead of the mock.", params: "live" },
      { method: "GET", path: "/api/cameras/bulk", cap: "camera.write", summary: "Download the bulk-onboarding CSV template." },
      { method: "POST", path: "/api/cameras/bulk", cap: "camera.write", summary: "Bulk onboard from CSV. Bad rows are rejected individually with line numbers; good rows still import.", sample: `{ "csv": "name,site,district,lat,lng,dept_id,…" }` },
    ],
  },
  {
    name: "Federation (Model 3)",
    note: "One adapter per department + vendor + protocol. Credentials are vault references, never secrets.",
    endpoints: [
      { method: "GET", path: "/api/adapters", cap: "adapter.read", summary: "Adapter inventory with health, latency, event counts and camera coverage." },
      { method: "GET", path: "/api/adapters/{id}", cap: "adapter.read", summary: "One adapter, its cameras and its raw vendor payload sample." },
      { method: "PATCH", path: "/api/adapters/{id}", cap: "adapter.write", summary: "Rotate the credential reference or rename the adapter.", sample: `{ "credentialsRef": "vault://gujarat/sentinel/d02/hikvision#v2" }` },
    ],
  },
  {
    name: "Analytics & detections",
    endpoints: [
      { method: "GET", path: "/api/detections", cap: "camera.read", summary: "Query stored detections.", params: "camera, type, plate, since, limit" },
      { method: "GET", path: "/api/trace", cap: "trace.read", summary: "Reconstruct a vehicle's route: ordered hops, per-leg distance/time/implied speed and a plausibility verdict per leg.", params: "plate (required), fuzzy, from, to" },
      { method: "GET", path: "/api/events", cap: "any session", summary: "Server-Sent Events stream of every bus topic the session is entitled to. Department scoping is applied on the server before a frame is written." },
      { method: "GET", path: "/api/stats", cap: "camera.read", summary: "Platform counters: cameras, adapters, detections, alerts, bus throughput, audit chain state." },
    ],
    note: "Trace results include flagged legs — a transition that implies an impossible speed is reported, not silently drawn.",
  },
  {
    name: "Watchlist & alerting",
    note: "A new entry is matched against live feeds immediately and re-checked against the last 12 hours of stored detections.",
    endpoints: [
      { method: "GET", path: "/api/watchlist", cap: "watchlist.read", summary: "List entries with per-entry match counts.", params: "kind, category, q" },
      { method: "POST", path: "/api/watchlist", cap: "watchlist.write", summary: "Add an entry; validates the registration format and rejects active duplicates.", sample: `{ "kind": "vehicle", "category": "stolen_vehicle",\n  "value": "GJ01AB1234", "severity": "critical",\n  "caseRef": "FIR/2026/AMD/0417" }` },
      { method: "GET", path: "/api/watchlist/{id}", cap: "watchlist.read", summary: "One entry with its full match history." },
      { method: "PATCH", path: "/api/watchlist/{id}", cap: "watchlist.write", summary: "Update or activate/deactivate. Reactivation re-runs historic correlation." },
      { method: "DELETE", path: "/api/watchlist/{id}", cap: "watchlist.write", summary: "Remove an entry." },
      { method: "POST", path: "/api/watchlist/bulk", cap: "watchlist.write", summary: "CSV bulk import." },
      { method: "GET", path: "/api/alerts", cap: "alert.read", summary: "Alert queue with camera and watchlist context.", params: "status, severity, limit" },
      { method: "PATCH", path: "/api/alerts/{id}", cap: "alert.action", summary: "Acknowledge, dispatch or close; every transition is audited.", sample: `{ "status": "dispatched", "note": "PCR van 12 en route" }` },
    ],
  },
  {
    name: "Reporting & governance",
    note: "CSV exports mirror their JSON counterparts and are logged to the audit trail on download.",
    endpoints: [
      { method: "GET", path: "/api/reports/detections", cap: "report.export", summary: "CSV of plate detections with timestamp, location, department, watchlist status and evidence reference.", params: "camera, since" },
      { method: "GET", path: "/api/reports/trace", cap: "report.export", summary: "CSV route report with a header block and per-leg plausibility.", params: "plate (required), fuzzy, from, to" },
      { method: "GET", path: "/api/reports/gap-analysis", cap: "report.export", summary: "CSV coverage report, one row per district with a priority-ranked recommendation." },
      { method: "GET", path: "/api/gap-analysis", cap: "gap.read", summary: "Structured gap analysis: uncovered districts, ANPR-blind districts, offline/degraded/stale/aging/analog/short-retention findings." },
      { method: "GET", path: "/api/audit", cap: "audit.read", summary: "Hash-chained audit log plus a chain-integrity verdict.", params: "action, actor, q, limit" },
      { method: "GET|POST", path: "/api/scenario", cap: "trace.read", summary: "Read or set the designated evaluation vehicle; setting it launches a live corridor journey for that plate.", sample: `{ "plate": "GJ01AB1234" }` },
    ],
  },
];

const METHOD_TONE: Record<string, "ok" | "accent" | "info" | "alarm" | "neutral"> = {
  GET: "info",
  POST: "ok",
  PATCH: "accent",
  DELETE: "alarm",
  "GET|POST": "info",
};

export default function ApiDocsPage() {
  return (
    <div className="space-y-3">
      <Panel
        title="REST API reference"
        subtitle="Integration readiness (FR20). Every endpoint is authenticated, capability-checked and department-scoped by the same server-side guard."
      >
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Authentication", "Session cookie `sentinel_session`, HMAC-signed and httpOnly. Obtain it from POST /api/auth/login."],
            ["Authorization", "Each endpoint declares one capability. Roles map to capabilities in one matrix; department admins are additionally scoped to their own deptId."],
            ["Errors", "JSON `{ error: string }` with 400 (validation), 401 (no session), 403 (capability or scope), 404, 409 (duplicate)."],
          ].map(([t, d]) => (
            <div key={t} className="rounded border border-ink-700 bg-ink-900/50 px-3 py-2">
              <div className="text-[11.5px] font-medium text-saffron-300">{t}</div>
              <div className="mt-0.5 text-[11px] text-mist-400">{d}</div>
            </div>
          ))}
        </div>
      </Panel>

      {GROUPS.map((g) => (
        <Panel key={g.name} title={g.name} subtitle={g.note} bodyClassName="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Method</Th>
                <Th>Path</Th>
                <Th>Capability</Th>
                <Th>Description</Th>
              </tr>
            </thead>
            <tbody>
              {g.endpoints.map((e) => (
                <tr key={`${e.method}${e.path}`}>
                  <Td>
                    <Badge tone={METHOD_TONE[e.method] ?? "neutral"}>{e.method}</Badge>
                  </Td>
                  <Td className="font-mono text-mist-100">{e.path}</Td>
                  <Td className="font-mono text-[10.5px] text-mist-400">{e.cap}</Td>
                  <Td>
                    <div className="max-w-[40rem] text-mist-300">{e.summary}</div>
                    {e.params && (
                      <div className="mt-0.5 text-[10px] text-mist-400">
                        Query: <span className="font-mono">{e.params}</span>
                      </div>
                    )}
                    {e.sample && (
                      <pre className="mt-1 overflow-x-auto rounded border border-ink-700 bg-ink-900 p-2 font-mono text-[10px] whitespace-pre-wrap text-mist-300">
                        {e.sample}
                      </pre>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      ))}

      <Panel title="Extending the platform" subtitle="The two interfaces that matter">
        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] font-medium text-saffron-300">Onboarding a new VMS vendor</div>
            <pre className="overflow-x-auto rounded border border-ink-700 bg-ink-900 p-3 font-mono text-[10.5px] text-mist-300">{`// src/lib/adapters.ts
export interface VmsAdapter {
  kind: string;
  supports(protocol: Protocol): boolean;
  testConnection(camera: Camera): Promise<ConnectionResult>;
  normalizeHealth(camera: Camera, raw: string): NormalizedHealth;
  streamUrl(camera: Camera): string;
}`}</pre>
            <p className="mt-1.5 text-[10.5px] text-mist-400">
              Implement it, register it, and that vendor's cameras federate. Nothing above the adapter layer changes.
            </p>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-medium text-saffron-300">Replacing the simulated analytics</div>
            <pre className="overflow-x-auto rounded border border-ink-700 bg-ink-900 p-3 font-mono text-[10.5px] text-mist-300">{`// src/lib/analytics.ts
export interface DetectionSource {
  readonly name: string;
  start(): void;
  stop(): void;
  running(): boolean;
}

// Publish via emitDetection(detection) and the
// correlation engine, alerting, trace and reports
// all work unchanged.`}</pre>
            <p className="mt-1.5 text-[10.5px] text-mist-400">
              A real YOLO + OCR worker implements this and publishes to the same topics. The rest of the platform cannot
              tell which source produced a detection — only the <code>source</code> field records it.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
