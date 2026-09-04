"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CameraTile } from "@/components/CameraTile";
import { AlertQueue } from "@/components/AlertQueue";
import { Badge, Button, Empty, Panel, Spinner, Stat, StatusDot, ist, inputClass, timeAgo } from "@/components/ui";
import { useAlertFeed, useDetectionFeed } from "@/components/useLive";
import type { Camera, Department, Detection } from "@/lib/types";

interface Stats {
  cameras: { total: number; online: number; degraded: number; offline: number; anpr: number; analog: number };
  departments: number;
  adapters: number;
  watchlist: { total: number; active: number; vehicles: number; persons: number };
  detections: { stored: number; lastHour: number; plates: number; uniquePlatesLastHour: number };
  alerts: { total: number; new: number; critical: number };
  engine: { detectionSource: string; running: boolean; startedAt: string };
  designatedVehicle: string | null;
}

const LAYOUTS = [
  { id: 4, label: "2 × 2", cls: "grid-cols-1 sm:grid-cols-2" },
  { id: 9, label: "3 × 3", cls: "grid-cols-2 lg:grid-cols-3" },
  { id: 16, label: "4 × 4", cls: "grid-cols-2 lg:grid-cols-4" },
];

export default function DashboardPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [layout, setLayout] = useState(LAYOUTS[1]);
  const [selected, setSelected] = useState<string[]>([]);
  const [deptFilter, setDeptFilter] = useState("");
  const [search, setSearch] = useState("");

  const { detections } = useDetectionFeed(140);
  const { alerts, connected, setAlerts } = useAlertFeed(60);

  useEffect(() => {
    Promise.all([
      fetch("/api/cameras").then((r) => r.json()),
      fetch("/api/stats").then((r) => r.json()),
    ])
      .then(([cams, st]) => {
        setCameras(cams.cameras ?? []);
        setDepartments(cams.departments ?? []);
        setStats(st);
        // Default wall: the ANPR cameras that are actually up, since those are what
        // generate the watchlist hits an operator is watching for.
        const preferred = (cams.cameras as Camera[])
          .filter((c) => c.status === "online" && c.anprEnabled)
          .slice(0, 9)
          .map((c) => c.id);
        setSelected(preferred.length ? preferred : (cams.cameras as Camera[]).slice(0, 9).map((c) => c.id));
      })
      .finally(() => setLoading(false));
  }, []);

  // Refresh counters periodically; the alert/detection feeds are already live.
  useEffect(() => {
    const t = setInterval(() => {
      fetch("/api/stats")
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => s && setStats(s))
        .catch(() => undefined);
    }, 15000);
    return () => clearInterval(t);
  }, []);

  const byCamera = useMemo(() => {
    const m = new Map<string, Detection[]>();
    for (const d of detections) {
      const arr = m.get(d.cameraId) ?? [];
      if (arr.length < 4) arr.push(d);
      m.set(d.cameraId, arr);
    }
    return m;
  }, [detections]);

  const alarmedCameras = useMemo(
    () => new Set(alerts.filter((a) => a.status === "new").map((a) => a.cameraId)),
    [alerts],
  );

  const visibleCameras = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cameras.filter(
      (c) =>
        (!deptFilter || c.deptId === deptFilter) &&
        (!q || `${c.id} ${c.name} ${c.site} ${c.district}`.toLowerCase().includes(q)),
    );
  }, [cameras, deptFilter, search]);

  const wall = selected.map((id) => cameras.find((c) => c.id === id)).filter(Boolean) as Camera[];

  const toggle = useCallback((id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const jumpToAlert = useCallback((cameraId: string) => {
    setSelected((prev) => (prev.includes(cameraId) ? prev : [cameraId, ...prev]));
    document.getElementById("video-wall")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (loading) return <Spinner label="Connecting to federation middleware" />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Cameras online"
          value={`${stats?.cameras.online ?? 0}/${stats?.cameras.total ?? 0}`}
          sub={`${stats?.cameras.anpr ?? 0} ANPR · ${stats?.cameras.analog ?? 0} analog`}
          tone="ok"
        />
        <Stat label="Departments federated" value={stats?.departments ?? 0} sub={`${stats?.adapters ?? 0} adapters`} tone="signal" />
        <Stat
          label="Detections / hour"
          value={stats?.detections.lastHour ?? 0}
          sub={`${stats?.detections.uniquePlatesLastHour ?? 0} unique plates`}
          tone="accent"
        />
        <Stat
          label="Open alerts"
          value={stats?.alerts.new ?? 0}
          sub={`${stats?.alerts.critical ?? 0} critical`}
          tone={stats?.alerts.new ? "alarm" : "neutral"}
        />
        <Stat
          label="Watchlist active"
          value={stats?.watchlist.active ?? 0}
          sub={`${stats?.watchlist.vehicles ?? 0} vehicles · ${stats?.watchlist.persons ?? 0} persons`}
        />
        <Stat
          label="Analytics pipeline"
          value={stats?.engine.running ? "RUNNING" : "STOPPED"}
          sub={`${stats?.engine.detectionSource ?? "—"} · since ${timeAgo(stats?.engine.startedAt)}`}
          tone={stats?.engine.running ? "ok" : "alarm"}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          <Panel
            title="Video wall"
            subtitle={`${wall.length} of ${cameras.length} cameras · streams relayed through the federation layer, source VMS untouched`}
            actions={
              <div className="flex items-center gap-1.5">
                {LAYOUTS.map((l) => (
                  <Button
                    key={l.id}
                    size="sm"
                    variant={layout.id === l.id ? "primary" : "ghost"}
                    onClick={() => setLayout(l)}
                  >
                    {l.label}
                  </Button>
                ))}
              </div>
            }
            bodyClassName="p-3"
          >
            <div id="video-wall" className={`grid gap-2 ${layout.cls}`}>
              {wall.slice(0, layout.id).map((c) => (
                <CameraTile
                  key={c.id}
                  camera={c}
                  detections={byCamera.get(c.id) ?? []}
                  alarm={alarmedCameras.has(c.id)}
                  onSelect={() => toggle(c.id)}
                  compact={layout.id === 16}
                />
              ))}
              {!wall.length && <Empty>Select cameras below to build the wall.</Empty>}
            </div>
          </Panel>

          <Panel
            title="Camera selector"
            subtitle="Click to add or remove a camera from the wall"
            actions={
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  className={`${inputClass} w-40`}
                  placeholder="Search cameras…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select className={`${inputClass} w-44`} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.shortName}
                    </option>
                  ))}
                </select>
              </div>
            }
            bodyClassName="p-2"
          >
            <div className="max-h-56 overflow-y-auto">
              <div className="flex flex-wrap gap-1.5">
                {visibleCameras.map((c) => {
                  const on = selected.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggle(c.id)}
                      title={`${c.site} · ${c.vendor} · ${c.protocol.toUpperCase()}`}
                      className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] transition-colors ${
                        on
                          ? "border-saffron-500/60 bg-saffron-500/12 text-saffron-300"
                          : "border-ink-700 bg-ink-850/60 text-mist-300 hover:border-ink-600 hover:text-mist-100"
                      }`}
                    >
                      <StatusDot
                        tone={c.status === "online" ? "ok" : c.status === "degraded" ? "warn" : "alarm"}
                        pulse={c.status === "online"}
                      />
                      <span className="font-mono">{c.id}</span>
                      <span className="max-w-32 truncate">{c.name.replace(/^CAM-[A-Z0-9-]+\s/, "")}</span>
                      {c.anprEnabled && <Badge tone="signal">ANPR</Badge>}
                    </button>
                  );
                })}
                {!visibleCameras.length && <Empty>No cameras match this filter.</Empty>}
              </div>
            </div>
          </Panel>

          <Panel
            title="Live detection feed"
            subtitle="Events consumed from the bus — detection.anpr / detection.object / detection.person"
            actions={
              <Badge tone={connected ? "ok" : "alarm"}>
                <StatusDot tone={connected ? "ok" : "alarm"} pulse={connected} />
                {connected ? "streaming" : "disconnected"}
              </Badge>
            }
            bodyClassName="p-0"
          >
            <div className="max-h-64 overflow-y-auto">
              {detections.length === 0 && <Empty>Waiting for the first detection…</Empty>}
              <ul className="divide-y divide-ink-800">
                {detections.slice(0, 40).map((d) => {
                  const cam = cameras.find((c) => c.id === d.cameraId);
                  return (
                    <li key={d.id} className="animate-slide-in flex items-center gap-2 px-3 py-1.5 text-[11px]">
                      <span className="w-16 shrink-0 font-mono text-mist-400">
                        {ist(d.timestamp, { day: undefined, month: undefined })}
                      </span>
                      <Badge tone={d.type === "plate" ? "accent" : "signal"}>{d.type}</Badge>
                      <span className="w-24 shrink-0 font-mono text-mist-100">{d.value}</span>
                      <span className="truncate text-mist-400">
                        {cam?.name ?? d.cameraId} · {cam?.district ?? ""}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-mist-400">
                        {Math.round(d.confidence * 100)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Panel>
        </div>

        <div className="space-y-3">
          <AlertQueue
            alerts={alerts}
            cameras={cameras}
            connected={connected}
            onChanged={(updated) => setAlerts((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)))}
            onJump={jumpToAlert}
          />

          {stats?.designatedVehicle && (
            <Panel title="Evaluation scenario" subtitle="Vehicle nominated for the trace test">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-base text-saffron-300">{stats.designatedVehicle}</span>
                <Link href={`/trace?plate=${stats.designatedVehicle}`}>
                  <Button size="sm" variant="primary">
                    Open trace
                  </Button>
                </Link>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
