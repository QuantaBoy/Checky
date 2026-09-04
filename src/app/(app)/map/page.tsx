"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapView, type MapMarker } from "@/components/MapView";
import { Badge, Button, Panel, Spinner, StatusDot, inputClass, ist, statusTone } from "@/components/ui";
import { useLive } from "@/components/useLive";
import type { Camera, Department } from "@/lib/types";

export default function MapPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Camera | null>(null);

  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [district, setDistrict] = useState("");
  const [anprOnly, setAnprOnly] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/cameras")
      .then((r) => r.json())
      .then((d) => {
        setCameras(d.cameras ?? []);
        setDepartments(d.departments ?? []);
        setDistricts(d.districts ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Health changes arrive on the bus; the map recolours without a reload.
  useLive(["camera.health"], (_t, payload) => {
    const p = payload as { cameraId: string; status: Camera["status"] };
    setCameras((prev) => prev.map((c) => (c.id === p.cameraId ? { ...c, status: p.status } : c)));
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return cameras.filter(
      (c) =>
        (!dept || c.deptId === dept) &&
        (!status || c.status === status) &&
        (!type || c.type === type) &&
        (!district || c.district === district) &&
        (!anprOnly || c.anprEnabled) &&
        (!s || `${c.id} ${c.name} ${c.site} ${c.vendor}`.toLowerCase().includes(s)),
    );
  }, [cameras, dept, status, type, district, anprOnly, q]);

  const markers: MapMarker[] = useMemo(
    () =>
      filtered.map((c) => ({
        id: c.id,
        lat: c.lat,
        lng: c.lng,
        label: `${c.id} · ${c.name}`,
        tone:
          c.status === "online" ? "ok" : c.status === "degraded" ? "warn" : c.status === "unreachable" ? "alarm" : "alarm",
        radius: c.anprEnabled ? 6 : 4.5,
        detail: [
          c.site,
          `${c.district} · ${departments.find((d) => d.id === c.deptId)?.shortName ?? c.deptId}`,
          `${c.vendor} · ${c.protocol.toUpperCase()}${c.analog ? " (analog)" : ""}`,
          `Retention ${c.retentionDays} days · ${c.storageType.replace("_", " ")}`,
          c.anprEnabled ? "ANPR enabled" : "No ANPR",
        ],
      })),
    [filtered, departments],
  );

  const counts = useMemo(
    () => ({
      online: filtered.filter((c) => c.status === "online").length,
      degraded: filtered.filter((c) => c.status === "degraded").length,
      down: filtered.filter((c) => c.status === "offline" || c.status === "unreachable").length,
      anpr: filtered.filter((c) => c.anprEnabled).length,
    }),
    [filtered],
  );

  if (loading) return <Spinner label="Loading registry map" />;

  return (
    <div className="space-y-3">
      <Panel
        title="GIS coverage map"
        subtitle={`${filtered.length} of ${cameras.length} onboarded cameras · layered by department, status and capability`}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <input className={`${inputClass} w-40`} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className={`${inputClass} w-40`} value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.shortName}
                </option>
              ))}
            </select>
            <select className={`${inputClass} w-32`} value={district} onChange={(e) => setDistrict(e.target.value)}>
              <option value="">All districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select className={`${inputClass} w-28`} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Any status</option>
              <option value="online">Online</option>
              <option value="degraded">Degraded</option>
              <option value="offline">Offline</option>
              <option value="unreachable">Unreachable</option>
            </select>
            <select className={`${inputClass} w-28`} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Any type</option>
              {["fixed", "dome", "bullet", "ptz", "anpr", "thermal"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-[11px] text-mist-300">
              <input type="checkbox" checked={anprOnly} onChange={(e) => setAnprOnly(e.target.checked)} />
              ANPR only
            </label>
          </div>
        }
        bodyClassName="p-2"
      >
        <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
          <Legend tone="ok" label={`Online ${counts.online}`} />
          <Legend tone="warn" label={`Degraded ${counts.degraded}`} />
          <Legend tone="alarm" label={`Offline/unreachable ${counts.down}`} />
          <span className="text-[10px] text-mist-400">Larger markers indicate ANPR-capable cameras ({counts.anpr}).</span>
        </div>
        <MapView markers={markers} height={560} onSelect={(id) => setSelected(cameras.find((c) => c.id === id) ?? null)} />
      </Panel>

      {selected && (
        <Panel
          title={`${selected.id} — ${selected.name}`}
          subtitle={selected.site}
          actions={
            <div className="flex gap-1.5">
              <Link href={`/registry/${selected.id}`}>
                <Button size="sm" variant="primary">
                  Open camera record
                </Button>
              </Link>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
          }
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11.5px] md:grid-cols-4">
            {[
              ["Status", <span key="s" className="flex items-center gap-1"><StatusDot tone={statusTone(selected.status)} />{selected.status}</span>],
              ["Department", departments.find((d) => d.id === selected.deptId)?.name ?? selected.deptId],
              ["District", selected.district],
              ["Vendor / model", `${selected.vendor} · ${selected.model}`],
              ["Protocol", `${selected.protocol.toUpperCase()}${selected.analog ? " (analog via encoder)" : ""}`],
              ["Storage", `${selected.storageType.replace("_", " ")} · ${selected.retentionDays} days`],
              ["ANPR", selected.anprEnabled ? "enabled" : "not enabled"],
              ["Last heartbeat", ist(selected.lastHeartbeat)],
              ["Coordinates", `${selected.lat.toFixed(4)}, ${selected.lng.toFixed(4)}`],
              ["Bearing / FOV", `${selected.bearing}° · ${selected.fovDeg}°`],
              ["Onboarded", ist(selected.onboardedAt)],
              ["Installed", ist(selected.installedAt, { hour: undefined, minute: undefined, second: undefined })],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="text-[10px] uppercase tracking-wider text-mist-400">{k}</dt>
                <dd className="text-mist-100">{v}</dd>
              </div>
            ))}
          </dl>
          {selected.notes && <p className="mt-2 text-[11px] text-warn-500">{selected.notes}</p>}
        </Panel>
      )}
    </div>
  );
}

function Legend({ tone, label }: { tone: "ok" | "warn" | "alarm"; label: string }) {
  return (
    <Badge tone={tone}>
      <StatusDot tone={tone} />
      {label}
    </Badge>
  );
}
