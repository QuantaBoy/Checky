"use client";

import { useEffect, useState } from "react";
import { Button, Empty, Field, Panel, Table, Td, Th, inputClass, ist } from "@/components/ui";
import type { Camera, Detection } from "@/lib/types";

/**
 * Reporting workspace — the evaluation deliverable "output report of detected
 * vehicles/plates with timestamps" plus the route and gap-analysis exports.
 */
export default function ReportsPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [camera, setCamera] = useState("");
  const [hours, setHours] = useState("8");
  const [preview, setPreview] = useState<Detection[]>([]);
  const [busy, setBusy] = useState(false);
  const [plate, setPlate] = useState("");

  useEffect(() => {
    fetch("/api/cameras")
      .then((r) => r.json())
      .then((d) => setCameras(d.cameras ?? []));
  }, []);

  const since = () => new Date(Date.now() - Number(hours || 8) * 3600_000).toISOString();

  const loadPreview = async () => {
    setBusy(true);
    try {
      const qs = new URLSearchParams({ type: "plate", since: since(), limit: "200" });
      if (camera) qs.set("camera", camera);
      const res = await fetch(`/api/detections?${qs}`);
      const data = await res.json();
      setPreview(data.detections ?? []);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial preview only
  }, []);

  const detectionExportUrl = () => {
    const qs = new URLSearchParams({ since: since() });
    if (camera) qs.set("camera", camera);
    return `/api/reports/detections?${qs}`;
  };

  return (
    <div className="space-y-3">
      <Panel
        title="Detection report"
        subtitle="Every plate read with timestamp, location, department, confidence and watchlist status — the submission deliverable for the government-provided feed"
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Camera" className="md:col-span-2">
            <select className={inputClass} value={camera} onChange={(e) => setCamera(e.target.value)}>
              <option value="">All cameras in scope</option>
              {cameras
                .filter((c) => c.anprEnabled)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} — {c.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Window (hours)">
            <input className={inputClass} value={hours} onChange={(e) => setHours(e.target.value)} inputMode="numeric" />
          </Field>
          <div className="flex items-end gap-2">
            <Button onClick={loadPreview} disabled={busy}>
              {busy ? "Loading…" : "Preview"}
            </Button>
            <a href={detectionExportUrl()}>
              <Button variant="primary">Export CSV</Button>
            </a>
          </div>
        </div>

        <div className="mt-3 max-h-96 overflow-auto rounded border border-ink-700">
          {!preview.length ? (
            <Empty>No plate detections in this window.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Timestamp (IST)</Th>
                  <Th>Plate</Th>
                  <Th>Camera</Th>
                  <Th>Site</Th>
                  <Th>District</Th>
                  <Th className="text-right">Conf.</Th>
                  <Th>Direction</Th>
                  <Th className="text-right">Speed</Th>
                </tr>
              </thead>
              <tbody>
                {preview.map((d) => {
                  const cam = cameras.find((c) => c.id === d.cameraId);
                  return (
                    <tr key={d.id}>
                      <Td className="font-mono text-mist-400">{ist(d.timestamp)}</Td>
                      <Td className="font-mono text-mist-100">{d.value}</Td>
                      <Td className="font-mono text-mist-300">{d.cameraId}</Td>
                      <Td className="max-w-56 truncate text-mist-300">{cam?.site ?? "—"}</Td>
                      <Td className="text-mist-300">{cam?.district ?? "—"}</Td>
                      <Td className="text-right font-mono">{Math.round(d.confidence * 100)}%</Td>
                      <Td className="text-mist-400">{d.direction ?? "—"}</Td>
                      <Td className="text-right font-mono text-mist-400">{d.speedKph ?? "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </div>
        <p className="mt-2 text-[10.5px] text-mist-400">
          Showing the most recent {preview.length} rows. The CSV export contains the full window and adds latitude,
          longitude, vendor, vehicle type/colour, watchlist status, case reference and the evidence frame reference.
        </p>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Vehicle route report" subtitle="Complete timestamped, location-wise movement history for one registration number">
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Registration number" className="flex-1">
              <input
                className={`${inputClass} font-mono uppercase`}
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="GJ01AB1234"
              />
            </Field>
            <a href={plate ? `/api/reports/trace?plate=${encodeURIComponent(plate)}` : undefined}>
              <Button variant="primary" disabled={!plate.trim()}>
                Export route CSV
              </Button>
            </a>
          </div>
          <p className="mt-2 text-[10.5px] text-mist-400">
            The export carries a header block (vehicle, generator, hit count, distance, flagged legs) followed by one row
            per camera hit, including each leg's distance, elapsed time, implied speed and whether it passed the
            plausibility check.
          </p>
        </Panel>

        <Panel title="Registry & coverage report" subtitle="Gap analysis in a form that can go to a planning meeting">
          <div className="flex flex-wrap gap-2">
            <a href="/api/reports/gap-analysis">
              <Button variant="primary">Export gap-analysis CSV</Button>
            </a>
            <Button variant="ghost" onClick={() => window.print()}>
              Print current view
            </Button>
          </div>
          <p className="mt-2 text-[10.5px] text-mist-400">
            One row per district: cameras in range, ANPR capability, availability, analog units, aging units, average
            retention, and a priority-ranked recommendation.
          </p>
        </Panel>
      </div>
    </div>
  );
}
