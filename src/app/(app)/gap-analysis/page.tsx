"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MapView, type MapMarker } from "@/components/MapView";
import { Badge, Button, Empty, Panel, Spinner, Stat, Table, Td, Th } from "@/components/ui";

interface Slim {
  id: string;
  name: string;
  site: string;
  district: string;
  deptId: string;
  status: string;
  vendor: string;
  ageYears?: number;
  retentionDays?: number;
}

interface Report {
  generatedAt: string;
  scope: string | null;
  parameters: { coverageRadiusKm: number; agingYears: number; staleHeartbeatMinutes: number };
  totals: { cameras: number; online: number; availability: number; districtsCovered: number; districtsTotal: number };
  findings: {
    uncoveredDistricts: { district: string; lat: number; lng: number }[];
    anprBlindDistricts: { district: string; lat: number; lng: number; cameras: number }[];
    offline: Slim[];
    degraded: Slim[];
    staleHeartbeat: Slim[];
    agingInfrastructure: Slim[];
    analogCameras: Slim[];
    shortRetention: Slim[];
  };
  byDepartment: {
    deptId: string;
    dept: string;
    vendor: string;
    total: number;
    online: number;
    offline: number;
    anpr: number;
    avgRetention: number;
    availability: number;
  }[];
  districtCoverage: { district: string; lat: number; lng: number; cameras: number; anpr: number; covered: boolean }[];
}

export default function GapAnalysisPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<keyof Report["findings"]>("uncoveredDistricts");

  useEffect(() => {
    fetch("/api/gap-analysis")
      .then((r) => r.json())
      .then(setReport)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Running gap analysis" />;
  if (!report) return <Empty>Report unavailable.</Empty>;

  const markers: MapMarker[] = report.districtCoverage.map((d) => ({
    id: d.district,
    lat: d.lat,
    lng: d.lng,
    label: d.district,
    tone: !d.covered ? "alarm" : d.anpr === 0 ? "warn" : "ok",
    radius: !d.covered ? 9 : 6,
    detail: [
      `${d.cameras} camera(s) within ${report.parameters.coverageRadiusKm} km of district HQ`,
      `${d.anpr} ANPR capable`,
      !d.covered ? "NO COVERAGE — priority 1" : d.anpr === 0 ? "No vehicle-tracing capability — priority 2" : "Covered",
    ],
  }));

  const TABS: { key: keyof Report["findings"]; label: string; tone: "alarm" | "warn" | "neutral" }[] = [
    { key: "uncoveredDistricts", label: `Uncovered districts (${report.findings.uncoveredDistricts.length})`, tone: "alarm" },
    { key: "anprBlindDistricts", label: `No ANPR coverage (${report.findings.anprBlindDistricts.length})`, tone: "warn" },
    { key: "offline", label: `Offline (${report.findings.offline.length})`, tone: "alarm" },
    { key: "degraded", label: `Degraded (${report.findings.degraded.length})`, tone: "warn" },
    { key: "staleHeartbeat", label: `Stale heartbeat (${report.findings.staleHeartbeat.length})`, tone: "warn" },
    { key: "agingInfrastructure", label: `Aging (${report.findings.agingInfrastructure.length})`, tone: "warn" },
    { key: "analogCameras", label: `Analog (${report.findings.analogCameras.length})`, tone: "neutral" },
    { key: "shortRetention", label: `Short retention (${report.findings.shortRetention.length})`, tone: "warn" },
  ];

  const rows = report.findings[tab] as (Slim & { cameras?: number })[];
  const isDistrictTab = tab === "uncoveredDistricts" || tab === "anprBlindDistricts";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Cameras in scope" value={report.totals.cameras} sub={report.scope ? `department ${report.scope}` : "statewide"} />
        <Stat label="Availability" value={`${report.totals.availability}%`} sub={`${report.totals.online} online`} tone={report.totals.availability > 85 ? "ok" : "warn"} />
        <Stat
          label="Districts covered"
          value={`${report.totals.districtsCovered}/${report.totals.districtsTotal}`}
          sub={`within ${report.parameters.coverageRadiusKm} km of HQ`}
          tone={report.totals.districtsCovered === report.totals.districtsTotal ? "ok" : "alarm"}
        />
        <Stat label="Aging units" value={report.findings.agingInfrastructure.length} sub={`over ${report.parameters.agingYears} years old`} tone="warn" />
        <Stat label="Short retention" value={report.findings.shortRetention.length} sub="under 15 days" tone="warn" />
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_460px]">
        <Panel
          title="Coverage map"
          subtitle="District headquarters shaded by coverage — red has no onboarded camera in range, amber has cameras but no ANPR"
          bodyClassName="p-2"
          actions={
            <div className="flex gap-1.5">
              <a href="/api/reports/gap-analysis">
                <Button size="sm">Export CSV</Button>
              </a>
              <Button size="sm" variant="ghost" onClick={() => window.print()}>
                Print / PDF
              </Button>
            </div>
          }
        >
          <MapView markers={markers} height={480} />
        </Panel>

        <Panel title="Department posture" subtitle="Availability and capability by owning department" bodyClassName="p-0">
          <div className="max-h-[520px] overflow-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Department</Th>
                  <Th>VMS</Th>
                  <Th className="text-right">Cams</Th>
                  <Th className="text-right">ANPR</Th>
                  <Th className="text-right">Avail.</Th>
                  <Th className="text-right">Retention</Th>
                </tr>
              </thead>
              <tbody>
                {report.byDepartment.map((d) => (
                  <tr key={d.deptId}>
                    <Td className="max-w-40 truncate text-mist-100">{d.dept}</Td>
                    <Td className="max-w-32 truncate text-[10px] text-mist-400">{d.vendor}</Td>
                    <Td className="text-right font-mono">{d.total}</Td>
                    <Td className="text-right font-mono">{d.anpr}</Td>
                    <Td className={`text-right font-mono ${d.availability < 70 ? "text-alarm-400" : d.availability < 90 ? "text-warn-500" : "text-ok-500"}`}>
                      {d.availability}%
                    </Td>
                    <Td className={`text-right font-mono ${d.avgRetention < 15 ? "text-warn-500" : "text-mist-300"}`}>{d.avgRetention}d</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Panel>
      </div>

      <Panel
        title="Findings"
        subtitle={`Generated ${new Date(report.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`}
        actions={
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <Button key={t.key} size="sm" variant={tab === t.key ? "primary" : "ghost"} onClick={() => setTab(t.key)}>
                {t.label}
              </Button>
            ))}
          </div>
        }
        bodyClassName="p-0"
      >
        {!rows.length ? (
          <Empty>Nothing flagged in this category.</Empty>
        ) : isDistrictTab ? (
          <Table>
            <thead>
              <tr>
                <Th>District</Th>
                <Th>Cameras in range</Th>
                <Th>Recommendation</Th>
              </tr>
            </thead>
            <tbody>
              {(rows as unknown as { district: string; cameras?: number }[]).map((r) => (
                <tr key={r.district}>
                  <Td className="text-mist-100">{r.district}</Td>
                  <Td className="font-mono">{r.cameras ?? 0}</Td>
                  <Td className="text-mist-300">
                    {tab === "uncoveredDistricts"
                      ? `Priority 1 — no onboarded camera within ${report.parameters.coverageRadiusKm} km of district HQ`
                      : "Priority 2 — cameras present but none ANPR-capable, so vehicles cannot be traced here"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Camera</Th>
                  <Th>Site</Th>
                  <Th>District</Th>
                  <Th>Vendor</Th>
                  <Th>Status</Th>
                  {tab === "agingInfrastructure" && <Th className="text-right">Age</Th>}
                  {tab === "shortRetention" && <Th className="text-right">Retention</Th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <Td className="font-mono">
                      <Link href={`/registry/${c.id}`} className="text-saffron-300 hover:underline">
                        {c.id}
                      </Link>
                    </Td>
                    <Td className="max-w-64 truncate text-mist-300">{c.site}</Td>
                    <Td className="text-mist-300">{c.district}</Td>
                    <Td className="max-w-40 truncate text-[10px] text-mist-400">{c.vendor}</Td>
                    <Td>
                      <Badge tone={c.status === "online" ? "ok" : c.status === "degraded" ? "warn" : "alarm"}>{c.status}</Badge>
                    </Td>
                    {tab === "agingInfrastructure" && <Td className="text-right font-mono text-warn-500">{c.ageYears} yr</Td>}
                    {tab === "shortRetention" && <Td className="text-right font-mono text-warn-500">{c.retentionDays} d</Td>}
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
