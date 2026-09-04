"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Empty, Field, Panel, Spinner, Stat, StatusDot, Table, Td, Th, inputClass, ist, statusTone, timeAgo } from "@/components/ui";
import { useLive } from "@/components/useLive";
import type { Adapter } from "@/lib/types";

interface Row extends Adapter {
  cameraCount: number;
  camerasOnline: number;
  dept: string;
}

export default function AdaptersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState({ healthy: 0, degraded: 0, down: 0, unconfigured: 0 });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [credential, setCredential] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch("/api/adapters")
      .then((r) => r.json())
      .then((d) => {
        setRows(d.adapters ?? []);
        setSummary(d.summary ?? summary);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useLive(["adapter.health"], (_t, payload) => {
    const p = payload as { adapterId: string; health: Adapter["health"] };
    setRows((prev) => prev.map((a) => (a.id === p.adapterId ? { ...a, health: p.health } : a)));
  });

  const saveCredential = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/adapters/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credentialsRef: credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Update failed");
        return;
      }
      setRows((prev) => prev.map((a) => (a.id === id ? { ...a, credentialsRef: data.adapter.credentialsRef } : a)));
      setOpen(null);
      setCredential("");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading federation adapters" />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Stat label="Adapters" value={rows.length} sub="one per department + vendor + protocol" />
        <Stat label="Healthy" value={summary.healthy} tone="ok" />
        <Stat label="Degraded" value={summary.degraded} tone="warn" />
        <Stat label="Down" value={summary.down} tone={summary.down ? "alarm" : "neutral"} />
        <Stat label="Unconfigured" value={summary.unconfigured} sub="awaiting credentials" />
      </div>

      <Panel
        title="Federation adapter console"
        subtitle="Each adapter fronts one department's VMS. Vendor differences stop here — everything above sees one schema."
        bodyClassName="p-0"
      >
        {!rows.length ? (
          <Empty>No adapters in scope.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Adapter</Th>
                <Th>Department</Th>
                <Th>Kind</Th>
                <Th>Cameras</Th>
                <Th>Latency</Th>
                <Th>Events published</Th>
                <Th>Health</Th>
                <Th>Heartbeat</Th>
                <Th>Credentials</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="hover:bg-ink-800/50">
                  <Td>
                    <div className="font-mono text-mist-300">{a.id}</div>
                    <div className="max-w-56 truncate text-[10px] text-mist-400">{a.name}</div>
                  </Td>
                  <Td className="text-mist-300">{a.dept}</Td>
                  <Td>
                    <Badge tone={a.kind === "vendor-sdk" ? "info" : a.kind === "mock" ? "neutral" : "signal"}>{a.kind}</Badge>
                  </Td>
                  <Td className="font-mono">
                    <span className={a.camerasOnline === a.cameraCount ? "text-ok-500" : "text-warn-500"}>
                      {a.camerasOnline}
                    </span>
                    <span className="text-mist-400">/{a.cameraCount}</span>
                  </Td>
                  <Td className="font-mono text-mist-300">{a.latencyMs} ms</Td>
                  <Td className="font-mono text-mist-300">{a.eventsPublished.toLocaleString("en-IN")}</Td>
                  <Td>
                    <Badge tone={statusTone(a.health)}>
                      <StatusDot tone={statusTone(a.health)} pulse={a.health === "healthy"} />
                      {a.health}
                    </Badge>
                  </Td>
                  <Td className="text-[10px] text-mist-400" title={ist(a.lastHeartbeat)}>
                    {timeAgo(a.lastHeartbeat)}
                  </Td>
                  <Td className="max-w-56 truncate font-mono text-[10px] text-mist-400" title={a.credentialsRef}>
                    {a.credentialsRef}
                  </Td>
                  <Td>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setOpen(open === a.id ? null : a.id);
                        setCredential(a.credentialsRef);
                      }}
                    >
                      {open === a.id ? "Close" : "Inspect"}
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      {open && (() => {
        const a = rows.find((x) => x.id === open);
        if (!a) return null;
        return (
          <Panel
            title={`${a.id} — ${a.name}`}
            subtitle={`${a.kind} adapter · version ${a.version}`}
            actions={
              <Button size="sm" variant="ghost" onClick={() => setOpen(null)}>
                Close
              </Button>
            }
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-mist-400">
                  Raw vendor payload sample (pre-normalization)
                </div>
                <pre className="max-h-56 overflow-auto rounded border border-ink-700 bg-ink-900 p-2 font-mono text-[10.5px] whitespace-pre-wrap text-mist-300">
                  {a.rawSample}
                </pre>
                <p className="mt-1.5 text-[10.5px] text-mist-400">
                  Downstream consumers never see this. The adapter maps it to the platform's{" "}
                  <code className="text-signal-400">camera.health</code> and{" "}
                  <code className="text-signal-400">detection.*</code> schemas before publishing to the bus.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-mist-400">Cameras behind this adapter</div>
                  <div className="flex flex-wrap gap-1">
                    {a.cameraIds.map((id) => (
                      <Link
                        key={id}
                        href={`/registry/${id}`}
                        className="rounded border border-ink-700 bg-ink-850 px-1.5 py-0.5 font-mono text-[10.5px] text-mist-300 hover:border-saffron-500/50 hover:text-saffron-300"
                      >
                        {id}
                      </Link>
                    ))}
                  </div>
                </div>

                <Field
                  label="Credential reference"
                  hint="Only a vault reference is stored. Raw passwords are rejected — secrets never enter application state."
                >
                  <input className={`${inputClass} font-mono`} value={credential} onChange={(e) => setCredential(e.target.value)} />
                </Field>
                {error && <p className="text-[11px] text-alarm-400">{error}</p>}
                <Button size="sm" variant="primary" onClick={() => saveCredential(a.id)} disabled={saving}>
                  {saving ? "Saving…" : "Update credential reference"}
                </Button>
              </div>
            </div>
          </Panel>
        );
      })()}
    </div>
  );
}
