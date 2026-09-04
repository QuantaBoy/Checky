"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Empty, Field, Panel, Table, Td, Th, inputClass } from "@/components/ui";
import type { Camera, Department } from "@/lib/types";

type Mode = "manual" | "bulk" | "api";

const BLANK = {
  name: "",
  site: "",
  district: "",
  lat: "",
  lng: "",
  deptId: "",
  type: "fixed",
  vendor: "",
  model: "",
  protocol: "rtsp",
  endpoint: "",
  streamUrl: "",
  storageType: "local_nvr",
  retentionDays: "30",
  bearing: "0",
  anprEnabled: false,
  analog: false,
};

export default function OnboardPage() {
  const [mode, setMode] = useState<Mode>("manual");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [scope, setScope] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ camera: Camera; probe: { reachable: boolean; detail: string; latencyMs: number } | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [csv, setCsv] = useState("");
  const [bulkResult, setBulkResult] = useState<{ accepted: number; rejected: { line: number; reason: string }[] } | null>(null);

  useEffect(() => {
    fetch("/api/cameras")
      .then((r) => r.json())
      .then((d) => {
        setDepartments(d.departments ?? []);
        setScope(d.scope ?? null);
        if (d.scope) setForm((f) => ({ ...f, deptId: d.scope }));
      });
  }, []);

  const set = (k: keyof typeof BLANK, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/cameras", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          lat: Number(form.lat),
          lng: Number(form.lng),
          retentionDays: Number(form.retentionDays),
          bearing: Number(form.bearing),
          streamUrl: form.streamUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Onboarding failed");
        return;
      }
      setResult(data);
      setForm({ ...BLANK, deptId: scope ?? form.deptId });
    } finally {
      setBusy(false);
    }
  };

  const submitBulk = async () => {
    setBusy(true);
    setError(null);
    setBulkResult(null);
    try {
      const res = await fetch("/api/cameras/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Bulk import failed");
        return;
      }
      setBulkResult(data);
    } finally {
      setBusy(false);
    }
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  return (
    <div className="space-y-3">
      <Panel
        title="Camera onboarding"
        subtitle="Flow A — register a camera in the central registry and attach it to a federation adapter"
        actions={
          <div className="flex gap-1.5">
            {(["manual", "bulk", "api"] as Mode[]).map((m) => (
              <Button key={m} size="sm" variant={mode === m ? "primary" : "ghost"} onClick={() => setMode(m)}>
                {m === "manual" ? "Manual entry" : m === "bulk" ? "Bulk CSV" : "API"}
              </Button>
            ))}
            <Link href="/registry">
              <Button size="sm" variant="ghost">
                ← Registry
              </Button>
            </Link>
          </div>
        }
      >
        {scope && (
          <p className="mb-3 rounded border border-info-500/40 bg-info-500/10 px-2.5 py-1.5 text-[11px] text-info-500">
            Your account is scoped to department {scope}. Cameras you onboard are registered to that department, and rows
            in a CSV that name a different department are rejected.
          </p>
        )}

        {mode === "manual" && (
          <form onSubmit={submitManual} className="grid gap-3 md:grid-cols-3">
            <Field label="Camera name" className="md:col-span-2">
              <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="CAM-AMD-11 Ring Road Gate" />
            </Field>
            <Field label="Department">
              <select className={inputClass} value={form.deptId} onChange={(e) => set("deptId", e.target.value)} disabled={Boolean(scope)} required>
                <option value="">Select…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id} — {d.shortName}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Site / location description" className="md:col-span-2">
              <input className={inputClass} value={form.site} onChange={(e) => set("site", e.target.value)} placeholder="Ring Road, Gate 2" />
            </Field>
            <Field label="District">
              <input className={inputClass} value={form.district} onChange={(e) => set("district", e.target.value)} placeholder="Ahmedabad" />
            </Field>

            <Field label="Latitude" hint="Decimal degrees, e.g. 23.0225">
              <input className={inputClass} value={form.lat} onChange={(e) => set("lat", e.target.value)} required inputMode="decimal" />
            </Field>
            <Field label="Longitude" hint="Decimal degrees, e.g. 72.5714">
              <input className={inputClass} value={form.lng} onChange={(e) => set("lng", e.target.value)} required inputMode="decimal" />
            </Field>
            <Field label="Camera bearing (°)" hint="Direction the camera faces — used for direction of travel">
              <input className={inputClass} value={form.bearing} onChange={(e) => set("bearing", e.target.value)} inputMode="numeric" />
            </Field>

            <Field label="Camera type">
              <select className={inputClass} value={form.type} onChange={(e) => set("type", e.target.value)}>
                {["fixed", "dome", "bullet", "ptz", "anpr", "thermal"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="VMS vendor">
              <input className={inputClass} value={form.vendor} onChange={(e) => set("vendor", e.target.value)} placeholder="Hikvision HikCentral" />
            </Field>
            <Field label="Model">
              <input className={inputClass} value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="DS-2CD2T87G2" />
            </Field>

            <Field label="Protocol">
              <select className={inputClass} value={form.protocol} onChange={(e) => set("protocol", e.target.value)}>
                {["rtsp", "onvif", "sdk", "hls"].map((p) => (
                  <option key={p} value={p}>
                    {p.toUpperCase()}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Endpoint" className="md:col-span-2" hint="The platform probes this address before accepting the camera">
              <input className={`${inputClass} font-mono`} value={form.endpoint} onChange={(e) => set("endpoint", e.target.value)} required placeholder="rtsp://10.22.14.5:554/stream1" />
            </Field>

            <Field label="Browser stream URL (optional)" className="md:col-span-3" hint="An HLS (.m3u8) or MJPEG URL the browser can play directly. Leave blank to use the simulated tile.">
              <input className={`${inputClass} font-mono`} value={form.streamUrl} onChange={(e) => set("streamUrl", e.target.value)} placeholder="https://…/index.m3u8" />
            </Field>

            <Field label="Storage type">
              <select className={inputClass} value={form.storageType} onChange={(e) => set("storageType", e.target.value)}>
                {["local_nvr", "cloud", "hybrid", "dvr"].map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Retention (days)">
              <input className={inputClass} value={form.retentionDays} onChange={(e) => set("retentionDays", e.target.value)} inputMode="numeric" />
            </Field>
            <div className="flex items-end gap-4 pb-1">
              <label className="flex items-center gap-1.5 text-[11px] text-mist-300">
                <input type="checkbox" checked={form.anprEnabled} onChange={(e) => set("anprEnabled", e.target.checked)} />
                ANPR enabled
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-mist-300">
                <input type="checkbox" checked={form.analog} onChange={(e) => set("analog", e.target.checked)} />
                Analog (via encoder)
              </label>
            </div>

            <div className="md:col-span-3">
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? "Probing endpoint…" : "Onboard camera"}
              </Button>
            </div>
          </form>
        )}

        {mode === "bulk" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <a href="/api/cameras/bulk">
                <Button size="sm">Download CSV template</Button>
              </a>
              <label className="cursor-pointer rounded border border-ink-600 bg-ink-700/70 px-2 py-1 text-[11px] text-mist-200 hover:bg-ink-600">
                Choose CSV file…
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) readFile(f);
                  }}
                />
              </label>
              <span className="text-[10.5px] text-mist-400">
                Columns: name, site, district, lat, lng, dept_id, type, vendor, model, protocol, endpoint, storage_type,
                retention_days, anpr_enabled, analog, bearing
              </span>
            </div>
            <textarea
              className={`${inputClass} h-56 font-mono text-[11px]`}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder="Paste CSV content here, or load a file above…"
            />
            <Button variant="primary" onClick={submitBulk} disabled={busy || !csv.trim()}>
              {busy ? "Importing…" : "Import cameras"}
            </Button>

            {bulkResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge tone="ok">{bulkResult.accepted} accepted</Badge>
                  <Badge tone={bulkResult.rejected.length ? "alarm" : "neutral"}>{bulkResult.rejected.length} rejected</Badge>
                </div>
                {bulkResult.rejected.length > 0 && (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Line</Th>
                        <Th>Reason</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkResult.rejected.map((r) => (
                        <tr key={r.line}>
                          <Td className="font-mono">{r.line}</Td>
                          <Td className="text-alarm-400">{r.reason}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
                <Link href="/registry" className="text-[11px] text-saffron-300 hover:underline">
                  View registry →
                </Link>
              </div>
            )}
          </div>
        )}

        {mode === "api" && (
          <div className="space-y-3 text-[12px] text-mist-300">
            <p>
              Departments already running an asset-management system can onboard programmatically. The endpoint is the
              same one this form posts to, and the same validation and audit rules apply.
            </p>
            <pre className="overflow-x-auto rounded border border-ink-700 bg-ink-900 p-3 font-mono text-[11px] text-mist-200">{`POST /api/cameras
Content-Type: application/json
Cookie: sentinel_session=<session>

{
  "name": "CAM-AMD-11 Ring Road Gate",
  "site": "Ring Road, Gate 2",
  "district": "Ahmedabad",
  "deptId": "D02",
  "lat": 23.0225,
  "lng": 72.5714,
  "type": "anpr",
  "vendor": "Hikvision HikCentral",
  "model": "DS-2CD2T87G2",
  "protocol": "onvif",
  "endpoint": "rtsp://10.22.14.5:554/stream1",
  "storageType": "local_nvr",
  "retentionDays": 30,
  "anprEnabled": true,
  "bearing": 180,
  "testConnection": true
}`}</pre>
            <p>
              The response carries the created camera and the adapter probe result. A camera that cannot be reached is
              still registered — with status <code className="text-warn-500">unreachable</code> — so it appears in the
              gap-analysis report rather than silently vanishing.
            </p>
            <Link href="/api-docs" className="text-saffron-300 hover:underline">
              Full API reference →
            </Link>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded border border-alarm-500/50 bg-alarm-500/10 px-2.5 py-1.5 text-[11px] text-alarm-400">
            {error}
          </p>
        )}
      </Panel>

      {result && (
        <Panel title="Onboarding result" subtitle={`${result.camera.id} registered`}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={result.camera.status === "online" ? "ok" : "warn"}>{result.camera.status}</Badge>
            <span className="font-mono text-[12px] text-mist-100">{result.camera.id}</span>
            <span className="text-[12px] text-mist-300">{result.camera.name}</span>
            <Link href={`/registry/${result.camera.id}`} className="ml-auto text-[11px] text-saffron-300 hover:underline">
              Open record →
            </Link>
          </div>
          {result.probe && (
            <div className="mt-2 rounded border border-ink-700 bg-ink-900/60 px-2.5 py-2 text-[11px]">
              <div className="text-mist-400">Adapter connection test</div>
              <div className={result.probe.reachable ? "text-ok-500" : "text-warn-500"}>
                {result.probe.reachable ? "Reachable" : "Not reachable"} · {result.probe.latencyMs} ms
              </div>
              <div className="mt-0.5 font-mono text-[10.5px] text-mist-300">{result.probe.detail}</div>
              {!result.probe.reachable && (
                <p className="mt-1 text-mist-400">
                  The camera stays in the registry and is listed under gap analysis. Fix the endpoint or firewall rule and
                  retry the connection test from the camera record.
                </p>
              )}
            </div>
          )}
        </Panel>
      )}

      {!result && !bulkResult && mode !== "api" && (
        <Empty>Onboarded cameras appear on the GIS map and become available to the federation layer immediately.</Empty>
      )}
    </div>
  );
}
