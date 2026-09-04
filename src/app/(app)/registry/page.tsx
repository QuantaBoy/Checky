"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Empty, Panel, Spinner, Stat, StatusDot, Table, Td, Th, inputClass, ist, statusTone, timeAgo } from "@/components/ui";
import { useLive } from "@/components/useLive";
import type { Camera, Department } from "@/lib/types";

type SortKey = "id" | "name" | "district" | "status" | "retentionDays" | "onboardedAt";

export default function RegistryPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [scope, setScope] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [district, setDistrict] = useState("");
  const [sort, setSort] = useState<SortKey>("id");
  const [asc, setAsc] = useState(true);

  const load = () => {
    fetch("/api/cameras")
      .then((r) => r.json())
      .then((d) => {
        setCameras(d.cameras ?? []);
        setDepartments(d.departments ?? []);
        setDistricts(d.districts ?? []);
        setScope(d.scope ?? null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useLive(["camera.health"], (_t, payload) => {
    const p = payload as { cameraId: string; status: Camera["status"] };
    setCameras((prev) => prev.map((c) => (c.id === p.cameraId ? { ...c, status: p.status } : c)));
  });

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = cameras.filter(
      (c) =>
        (!dept || c.deptId === dept) &&
        (!status || c.status === status) &&
        (!district || c.district === district) &&
        (!s || `${c.id} ${c.name} ${c.site} ${c.vendor} ${c.model} ${c.endpoint}`.toLowerCase().includes(s)),
    );
    out.sort((a, b) => {
      const va = a[sort];
      const vb = b[sort];
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return asc ? cmp : -cmp;
    });
    return out;
  }, [cameras, q, dept, status, district, sort, asc]);

  const counts = useMemo(
    () => ({
      online: cameras.filter((c) => c.status === "online").length,
      degraded: cameras.filter((c) => c.status === "degraded").length,
      down: cameras.filter((c) => c.status === "offline" || c.status === "unreachable").length,
      anpr: cameras.filter((c) => c.anprEnabled).length,
      analog: cameras.filter((c) => c.analog).length,
      vendors: new Set(cameras.map((c) => c.vendor)).size,
    }),
    [cameras],
  );

  const head = (key: SortKey, label: string) => (
    <Th className="cursor-pointer select-none" >
      <button
        onClick={() => {
          if (sort === key) setAsc((v) => !v);
          else {
            setSort(key);
            setAsc(true);
          }
        }}
        className="uppercase tracking-wider"
      >
        {label} {sort === key ? (asc ? "▲" : "▼") : ""}
      </button>
    </Th>
  );

  if (loading) return <Spinner label="Loading central registry" />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Registered cameras" value={cameras.length} sub={scope ? `scoped to ${scope}` : "statewide"} />
        <Stat label="Online" value={counts.online} tone="ok" />
        <Stat label="Degraded" value={counts.degraded} tone="warn" />
        <Stat label="Offline / unreachable" value={counts.down} tone={counts.down ? "alarm" : "neutral"} />
        <Stat label="ANPR capable" value={counts.anpr} tone="accent" />
        <Stat label="Distinct VMS vendors" value={counts.vendors} sub={`${counts.analog} analog via encoder`} tone="signal" />
      </div>

      <Panel
        title="Camera registry"
        subtitle="Single source of truth for what exists, who owns it, and how it is reached"
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <input className={`${inputClass} w-44`} placeholder="Search id, site, vendor…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className={`${inputClass} w-40`} value={dept} onChange={(e) => setDept(e.target.value)} disabled={Boolean(scope)}>
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
              {["online", "degraded", "offline", "unreachable"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Link href="/registry/onboard">
              <Button size="sm" variant="primary">
                + Onboard cameras
              </Button>
            </Link>
          </div>
        }
        bodyClassName="p-0"
      >
        {!rows.length ? (
          <Empty>No cameras match these filters.</Empty>
        ) : (
          <div className="max-h-[620px] overflow-auto">
            <Table>
              <thead>
                <tr>
                  {head("id", "ID")}
                  {head("name", "Camera")}
                  <Th>Department</Th>
                  {head("district", "District")}
                  <Th>Vendor / protocol</Th>
                  <Th>Storage</Th>
                  {head("retentionDays", "Retention")}
                  {head("status", "Status")}
                  <Th>Heartbeat</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-800/50">
                    <Td className="font-mono text-mist-300">{c.id}</Td>
                    <Td>
                      <div className="max-w-64 truncate text-mist-100">{c.name}</div>
                      <div className="max-w-64 truncate text-[10px] text-mist-400">{c.site}</div>
                    </Td>
                    <Td className="text-mist-300">{departments.find((d) => d.id === c.deptId)?.shortName ?? c.deptId}</Td>
                    <Td className="text-mist-300">{c.district}</Td>
                    <Td>
                      <div className="text-mist-300">{c.vendor}</div>
                      <div className="text-[10px] text-mist-400">
                        {c.protocol.toUpperCase()}
                        {c.analog ? " · analog" : ""}
                        {c.anprEnabled ? " · ANPR" : ""}
                      </div>
                    </Td>
                    <Td className="text-mist-300">{c.storageType.replace("_", " ")}</Td>
                    <Td className={`font-mono ${c.retentionDays < 15 ? "text-warn-500" : "text-mist-300"}`}>{c.retentionDays}d</Td>
                    <Td>
                      <Badge tone={statusTone(c.status)}>
                        <StatusDot tone={statusTone(c.status)} pulse={c.status === "online"} />
                        {c.status}
                      </Badge>
                    </Td>
                    <Td className="text-[10px] text-mist-400" title={ist(c.lastHeartbeat)}>
                      {timeAgo(c.lastHeartbeat)}
                    </Td>
                    <Td>
                      <Link href={`/registry/${c.id}`} className="text-[11px] text-saffron-300 hover:underline">
                        Open
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}
