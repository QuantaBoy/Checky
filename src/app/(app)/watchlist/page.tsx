"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Empty, Field, Panel, Spinner, Stat, Table, Td, Th, inputClass, ist, severityTone } from "@/components/ui";
import type { Alert, WatchlistEntry } from "@/lib/types";

interface Row extends WatchlistEntry {
  matchCount: number;
}

const BLANK = {
  kind: "vehicle",
  category: "stolen_vehicle",
  value: "",
  description: "",
  severity: "critical",
  source: "eGujCop (synthetic)",
  caseRef: "",
};

export default function WatchlistPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [form, setForm] = useState({ ...BLANK });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [csv, setCsv] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [history, setHistory] = useState<{ entry: WatchlistEntry; alerts: Alert[] } | null>(null);
  const [canWrite, setCanWrite] = useState(true);

  const load = () => {
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((d) => setRows(d.watchlist ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setCanWrite((d.capabilities ?? []).includes("watchlist.write")))
      .catch(() => undefined);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (w) => (!kind || w.kind === kind) && (!s || `${w.value} ${w.description} ${w.caseRef} ${w.source}`.toLowerCase().includes(s)),
    );
  }, [rows, q, kind]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not add entry");
        return;
      }
      setNotice(
        data.historicMatches
          ? `${data.entry.value} added. ${data.historicMatches} historic sighting(s) matched immediately and are in the alert queue.`
          : `${data.entry.value} added. Live feeds are now being cross-referenced against it.`,
      );
      setForm({ ...BLANK });
      load();
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (w: Row) => {
    const res = await fetch(`/api/watchlist/${w.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !w.active }),
    });
    if (res.ok) load();
  };

  const remove = async (w: Row) => {
    if (!confirm(`Remove ${w.value} from the watchlist? This is recorded in the audit trail.`)) return;
    const res = await fetch(`/api/watchlist/${w.id}`, { method: "DELETE" });
    if (res.ok) load();
  };

  const openHistory = async (id: string) => {
    const res = await fetch(`/api/watchlist/${id}`);
    if (res.ok) setHistory(await res.json());
  };

  const importCsv = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/watchlist/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
        return;
      }
      setNotice(`${data.accepted} entries imported, ${data.rejected.length} rejected, ${data.historicMatches} historic match(es) raised.`);
      setCsv("");
      setShowImport(false);
      load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="Loading watchlist" />;

  const stats = {
    active: rows.filter((w) => w.active).length,
    vehicles: rows.filter((w) => w.kind === "vehicle").length,
    persons: rows.filter((w) => w.kind === "person").length,
    matches: rows.reduce((s, w) => s + w.matchCount, 0),
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Active entries" value={stats.active} sub={`${rows.length} total`} tone="accent" />
        <Stat label="Vehicles" value={stats.vehicles} />
        <Stat label="Persons" value={stats.persons} sub="FRS matching is a stretch capability" />
        <Stat label="Matches raised" value={stats.matches} tone={stats.matches ? "alarm" : "neutral"} />
      </div>

      {canWrite && (
        <Panel
          title="Add watchlist entry"
          subtitle="New entries are cross-referenced against live feeds immediately, and against the last 12 hours of stored detections"
          actions={
            <div className="flex gap-1.5">
              <a href="/api/watchlist/bulk">
                <Button size="sm" variant="ghost">
                  CSV template
                </Button>
              </a>
              <Button size="sm" onClick={() => setShowImport((v) => !v)}>
                {showImport ? "Close import" : "Bulk import"}
              </Button>
            </div>
          }
        >
          <form onSubmit={add} className="grid gap-3 md:grid-cols-6">
            <Field label="Kind">
              <select
                className={inputClass}
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    kind: e.target.value,
                    category: e.target.value === "person" ? "wanted_person" : "stolen_vehicle",
                  }))
                }
              >
                <option value="vehicle">Vehicle</option>
                <option value="person">Person</option>
              </select>
            </Field>
            <Field label={form.kind === "vehicle" ? "Registration number" : "Person identifier"}>
              <input
                className={`${inputClass} ${form.kind === "vehicle" ? "font-mono uppercase" : ""}`}
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder={form.kind === "vehicle" ? "GJ01AB1234" : "Suspect C (synthetic)"}
                required
              />
            </Field>
            <Field label="Category">
              <select className={inputClass} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {(form.kind === "vehicle"
                  ? ["stolen_vehicle", "blacklisted_vehicle", "suspect_vehicle"]
                  : ["wanted_person", "missing_person"]
                ).map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Severity">
              <select className={inputClass} value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>
                {["critical", "high", "medium", "low"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source system">
              <input className={inputClass} value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
            </Field>
            <Field label="Case reference">
              <input className={inputClass} value={form.caseRef} onChange={(e) => setForm((f) => ({ ...f, caseRef: e.target.value }))} placeholder="FIR/2026/AMD/0417" />
            </Field>
            <Field label="Description" className="md:col-span-5">
              <input className={inputClass} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="White Maruti Swift reported stolen from Navrangpura" />
            </Field>
            <div className="flex items-end">
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? "Adding…" : "Add entry"}
              </Button>
            </div>
          </form>

          {showImport && (
            <div className="mt-3 space-y-2 border-t border-ink-700 pt-3">
              <textarea
                className={`${inputClass} h-32 font-mono text-[11px]`}
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                placeholder="kind,category,value,description,severity,source,case_ref"
              />
              <Button size="sm" variant="primary" onClick={importCsv} disabled={busy || !csv.trim()}>
                Import CSV
              </Button>
            </div>
          )}

          {error && <p className="mt-3 rounded border border-alarm-500/50 bg-alarm-500/10 px-2.5 py-1.5 text-[11px] text-alarm-400">{error}</p>}
          {notice && <p className="mt-3 rounded border border-ok-500/40 bg-ok-500/10 px-2.5 py-1.5 text-[11px] text-ok-500">{notice}</p>}

          <p className="mt-3 text-[10.5px] text-mist-400">
            In production these rows are sourced from VAHAN, SARTHI, eGujCop, AFIS and NAFIS through the same adapter
            interface the cameras use. Everything shown here is synthetic demo data.
          </p>
        </Panel>
      )}

      <Panel
        title="Watchlist"
        subtitle="Vehicles and persons of interest currently being matched against every ANPR detection"
        actions={
          <div className="flex items-center gap-1.5">
            <input className={`${inputClass} w-44`} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className={`${inputClass} w-28`} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">All kinds</option>
              <option value="vehicle">Vehicles</option>
              <option value="person">Persons</option>
            </select>
          </div>
        }
        bodyClassName="p-0"
      >
        {!filtered.length ? (
          <Empty>No watchlist entries match.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Value</Th>
                <Th>Category</Th>
                <Th>Severity</Th>
                <Th>Description</Th>
                <Th>Source / case</Th>
                <Th>Added</Th>
                <Th>Matches</Th>
                <Th>State</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => (
                <tr key={w.id} className="hover:bg-ink-800/50">
                  <Td className="font-mono text-mist-400">{w.id}</Td>
                  <Td className="font-mono text-mist-100">
                    {w.kind === "vehicle" ? (
                      <Link href={`/trace?plate=${w.value}`} className="hover:text-saffron-300 hover:underline">
                        {w.value}
                      </Link>
                    ) : (
                      w.value
                    )}
                  </Td>
                  <Td className="text-mist-300">{w.category.replace(/_/g, " ")}</Td>
                  <Td>
                    <Badge tone={severityTone(w.severity)}>{w.severity}</Badge>
                  </Td>
                  <Td className="max-w-64 truncate text-mist-300">{w.description}</Td>
                  <Td className="text-[10px] text-mist-400">
                    <div>{w.source}</div>
                    <div>{w.caseRef}</div>
                  </Td>
                  <Td className="text-[10px] text-mist-400">
                    <div>{ist(w.addedAt, { hour: undefined, minute: undefined, second: undefined })}</div>
                    <div>{w.addedBy}</div>
                  </Td>
                  <Td>
                    <button onClick={() => openHistory(w.id)} className="font-mono text-saffron-300 hover:underline">
                      {w.matchCount}
                    </button>
                  </Td>
                  <Td>
                    <Badge tone={w.active ? "ok" : "neutral"}>{w.active ? "active" : "inactive"}</Badge>
                  </Td>
                  <Td>
                    {canWrite && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(w)}>
                          {w.active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(w)}>
                          Remove
                        </Button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      {history && (
        <Panel
          title={`Match history — ${history.entry.value}`}
          subtitle={`${history.alerts.length} alert(s) raised from this entry`}
          actions={
            <Button size="sm" variant="ghost" onClick={() => setHistory(null)}>
              Close
            </Button>
          }
          bodyClassName="p-0"
        >
          {!history.alerts.length ? (
            <Empty>No matches yet for this entry.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Raised</Th>
                  <Th>Seen at (IST)</Th>
                  <Th>Location</Th>
                  <Th>Plate read</Th>
                  <Th>Confidence</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {history.alerts.map((a) => (
                  <tr key={a.id}>
                    <Td className="font-mono text-mist-400">{ist(a.createdAt)}</Td>
                    <Td className="font-mono text-mist-300">{ist(a.evidence.timestamp)}</Td>
                    <Td className="max-w-64 truncate text-mist-300">{a.evidence.location.site}</Td>
                    <Td className="font-mono text-mist-100">{a.evidence.plate}</Td>
                    <Td className="font-mono">{Math.round(a.confidence * 100)}%</Td>
                    <Td>
                      <Badge tone={a.status === "new" ? "alarm" : "neutral"}>{a.status}</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      )}
    </div>
  );
}
