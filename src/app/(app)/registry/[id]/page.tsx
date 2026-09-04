"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CameraTile } from "@/components/CameraTile";
import { MapView } from "@/components/MapView";
import { Badge, Button, Empty, Panel, Spinner, StatusDot, Table, Td, Th, ist, severityTone, statusTone, timeAgo } from "@/components/ui";
import { useDetectionFeed } from "@/components/useLive";
import type { Adapter, Alert, Camera, Department, Detection } from "@/lib/types";

interface Payload {
  camera: Camera;
  department?: Department;
  adapter?: Adapter;
  detections: Detection[];
  alerts: Alert[];
}

interface Probe {
  adapterKind: string;
  simulated: boolean;
  probe: { reachable: boolean; latencyMs: number; detail: string; raw: string };
  normalized: { cameraId: string; status: string; at: string; fps?: number; bitrateKbps?: number };
  streamUrl: string;
}

export default function CameraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { detections: live } = useDetectionFeed(60);

  const load = useCallback(() => {
    fetch(`/api/cameras/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Not found");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  const test = async (liveProbe: boolean) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/cameras/${id}/test?live=${liveProbe}`, { method: "POST" });
      if (res.ok) {
        setProbe(await res.json());
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  const decommission = async () => {
    if (!confirm(`Remove ${id} from the registry? This is recorded in the audit trail.`)) return;
    const res = await fetch(`/api/cameras/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/registry");
  };

  if (loading) return <Spinner label={`Loading ${id}`} />;
  if (error || !data) return <Empty>{error ?? "Camera not found"}</Empty>;

  const { camera, department, adapter } = data;
  const liveForCamera = live.filter((d) => d.cameraId === camera.id).slice(0, 4);
  const recent = liveForCamera.length ? liveForCamera : data.detections.slice(0, 4);

  return (
    <div className="space-y-3">
      <Panel
        title={`${camera.id} — ${camera.name}`}
        subtitle={`${camera.site} · ${camera.district}`}
        actions={
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" onClick={() => test(false)} disabled={busy}>
              Simulated probe
            </Button>
            <Button size="sm" variant="primary" onClick={() => test(true)} disabled={busy}>
              {busy ? "Probing…" : "Live connection test"}
            </Button>
            <Button size="sm" variant="danger" onClick={decommission}>
              Decommission
            </Button>
            <Link href="/registry">
              <Button size="sm" variant="ghost">
                ← Registry
              </Button>
            </Link>
          </div>
        }
      >
        <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
          <CameraTile camera={camera} detections={recent} />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11.5px] sm:grid-cols-3">
            {[
              ["Status", <Badge key="st" tone={statusTone(camera.status)}><StatusDot tone={statusTone(camera.status)} />{camera.status}</Badge>],
              ["Owning department", department?.name ?? camera.deptId],
              ["Nodal officer", department?.nodalOfficer ?? "—"],
              ["Vendor / model", `${camera.vendor} · ${camera.model}`],
              ["Protocol", `${camera.protocol.toUpperCase()}${camera.analog ? " (analog via encoder)" : ""}`],
              ["Endpoint", <span key="ep" className="font-mono break-all text-[10.5px]">{camera.endpoint}</span>],
              ["Storage", `${camera.storageType.replace("_", " ")}`],
              ["Retention", `${camera.retentionDays} days`],
              ["ANPR", camera.anprEnabled ? "enabled" : "not enabled"],
              ["Coordinates", `${camera.lat.toFixed(5)}, ${camera.lng.toFixed(5)}`],
              ["Bearing / FOV", `${camera.bearing}° · ${camera.fovDeg}°`],
              ["Last heartbeat", `${ist(camera.lastHeartbeat)} (${timeAgo(camera.lastHeartbeat)})`],
              ["Onboarded", ist(camera.onboardedAt)],
              ["Installed", ist(camera.installedAt, { hour: undefined, minute: undefined, second: undefined })],
              ["Federation adapter", adapter ? `${adapter.id} · ${adapter.kind}` : "not attached"],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="text-[10px] uppercase tracking-wider text-mist-400">{k}</dt>
                <dd className="mt-0.5 text-mist-100">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        {camera.notes && (
          <p className="mt-3 rounded border border-warn-500/40 bg-warn-500/10 px-2.5 py-1.5 text-[11px] text-warn-500">
            {camera.notes}
          </p>
        )}
      </Panel>

      {probe && (
        <Panel
          title="Adapter connection test"
          subtitle={`${probe.adapterKind} adapter${probe.simulated ? " · SIMULATED — no packets left this host" : " · real TCP probe of the endpoint"}`}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-mist-400">Result</div>
              <Badge tone={probe.probe.reachable ? "ok" : "alarm"}>
                {probe.probe.reachable ? "reachable" : "unreachable"} · {probe.probe.latencyMs} ms
              </Badge>
              <p className="mt-1.5 text-[11px] text-mist-300">{probe.probe.detail}</p>
              <div className="mt-3 mb-1 text-[10px] uppercase tracking-wider text-mist-400">
                Normalized health (platform schema)
              </div>
              <pre className="overflow-x-auto rounded border border-ink-700 bg-ink-900 p-2 font-mono text-[10.5px] text-signal-400">
                {JSON.stringify(probe.normalized, null, 2)}
              </pre>
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-mist-400">
                Raw vendor payload (before normalization)
              </div>
              <pre className="max-h-64 overflow-auto rounded border border-ink-700 bg-ink-900 p-2 font-mono text-[10.5px] whitespace-pre-wrap text-mist-300">
                {probe.probe.raw}
              </pre>
              <p className="mt-1.5 text-[10.5px] text-mist-400">
                This is what federation actually does: each vendor speaks its own dialect on the left, and the platform
                stores and publishes the shape on the right. Nothing downstream knows which vendor produced it.
              </p>
            </div>
          </div>
        </Panel>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        <Panel title="Recent detections at this camera" subtitle="Newest first" bodyClassName="p-0">
          {!data.detections.length ? (
            <Empty>No detections recorded yet.</Empty>
          ) : (
            <div className="max-h-80 overflow-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>Time (IST)</Th>
                    <Th>Type</Th>
                    <Th>Value</Th>
                    <Th>Conf.</Th>
                    <Th>Direction</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.detections.map((d) => (
                    <tr key={d.id}>
                      <Td className="font-mono text-mist-400">{ist(d.timestamp)}</Td>
                      <Td>
                        <Badge tone={d.type === "plate" ? "accent" : "signal"}>{d.type}</Badge>
                      </Td>
                      <Td className="font-mono text-mist-100">
                        {d.type === "plate" ? (
                          <Link href={`/trace?plate=${d.value}`} className="hover:text-saffron-300 hover:underline">
                            {d.value}
                          </Link>
                        ) : (
                          d.value
                        )}
                      </Td>
                      <Td className="font-mono">{Math.round(d.confidence * 100)}%</Td>
                      <Td className="text-mist-400">{d.direction ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Panel>

        <div className="space-y-3">
          <Panel title="Location" bodyClassName="p-2">
            <MapView
              markers={[
                {
                  id: camera.id,
                  lat: camera.lat,
                  lng: camera.lng,
                  label: camera.name,
                  tone: statusTone(camera.status) === "ok" ? "ok" : statusTone(camera.status) === "warn" ? "warn" : "alarm",
                  detail: [camera.site],
                },
              ]}
              height={240}
              zoom={14}
            />
          </Panel>

          <Panel title="Alerts raised from this camera" bodyClassName="p-0">
            {!data.alerts.length ? (
              <Empty>No watchlist matches from this camera.</Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Time</Th>
                    <Th>Plate</Th>
                    <Th>Severity</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.alerts.map((a) => (
                    <tr key={a.id}>
                      <Td className="font-mono text-mist-400">{ist(a.createdAt)}</Td>
                      <Td className="font-mono text-mist-100">{a.evidence.plate}</Td>
                      <Td>
                        <Badge tone={severityTone(a.severity)}>{a.severity}</Badge>
                      </Td>
                      <Td className="text-mist-300">{a.status}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
