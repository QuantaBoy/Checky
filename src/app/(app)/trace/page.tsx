"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapView, type MapMarker, type MapRoute } from "@/components/MapView";
import { Badge, Button, Empty, Field, Panel, Spinner, Stat, Table, Td, Th, inputClass, ist } from "@/components/ui";
import type { Camera } from "@/lib/types";
import type { TraceResult } from "@/lib/trace";

interface TraceResponse extends TraceResult {
  predictedNext: { camera: Camera; km: number }[];
}

export default function TracePage() {
  return (
    <Suspense fallback={<Spinner label="Loading trace module" />}>
      <TraceInner />
    </Suspense>
  );
}

function TraceInner() {
  const params = useSearchParams();
  const [plate, setPlate] = useState(params.get("plate") ?? "");
  const [fuzzy, setFuzzy] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<TraceResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [designated, setDesignated] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/scenario")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setSuggestions(d.watchlistVehicles ?? []);
        setDesignated(d.designatedVehicle ?? null);
      })
      .catch(() => undefined);
  }, []);

  const run = useCallback(
    async (value: string, opts: { fuzzy?: boolean; from?: string; to?: string } = {}) => {
      const target = value.trim();
      if (!target) return;
      setBusy(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ plate: target });
        if (opts.fuzzy ?? fuzzy) qs.set("fuzzy", "true");
        if (opts.from ?? from) qs.set("from", new Date(opts.from ?? from).toISOString());
        if (opts.to ?? to) qs.set("to", new Date(opts.to ?? to).toISOString());
        const res = await fetch(`/api/trace?${qs}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Trace failed");
          setResult(null);
          return;
        }
        setResult(data);
      } catch {
        setError("Could not reach the platform");
      } finally {
        setBusy(false);
      }
    },
    [fuzzy, from, to],
  );

  // Deep link from an alert: /trace?plate=GJ01AB1234 runs immediately.
  useEffect(() => {
    const p = params.get("plate");
    if (p) run(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the incoming link
  }, []);

  const markers: MapMarker[] =
    result?.hops.map((h, i) => ({
      id: h.cameraId,
      lat: h.lat,
      lng: h.lng,
      label: h.cameraName,
      index: i + 1,
      tone: h.fuzzy ? "warn" : "accent",
      detail: [h.site, `${ist(h.timestamp)} IST`, `${h.plateRead} · ${Math.round(h.confidence * 100)}%`, h.direction ?? ""],
    })) ?? [];

  const route: MapRoute | undefined = result
    ? {
        points: result.hops.map((h) => ({ lat: h.lat, lng: h.lng })),
        segmentPlausible: result.hops.slice(1).map((h) => h.leg?.plausible ?? true),
      }
    : undefined;

  const designate = async () => {
    if (!plate.trim()) return;
    const res = await fetch("/api/scenario", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plate: plate.trim() }),
    });
    if (res.ok) {
      const d = await res.json();
      setDesignated(d.designatedVehicle);
    }
  };

  return (
    <div className="space-y-3">
      <Panel
        title="Vehicle & person trace"
        subtitle="Reconstructs a timestamped, location-wise movement history across every federated camera"
      >
        <form
          className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            run(plate);
          }}
        >
          <Field label="Vehicle registration number">
            <input
              className={`${inputClass} font-mono uppercase`}
              placeholder="GJ01AB1234"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              autoFocus
            />
          </Field>
          <Field label="From (optional)">
            <input type="datetime-local" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To (optional)">
            <input type="datetime-local" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Tracing…" : "Trace"}
            </Button>
          </div>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-mist-300">
            <input type="checkbox" checked={fuzzy} onChange={(e) => setFuzzy(e.target.checked)} />
            Include OCR-variant reads (one-character difference)
          </label>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-mist-400">Watchlisted:</span>
              {suggestions.slice(0, 6).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setPlate(s);
                    run(s);
                  }}
                  className="rounded border border-ink-700 bg-ink-850 px-1.5 py-0.5 font-mono text-[10.5px] text-saffron-300 hover:border-saffron-500/50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {designated && (
              <Badge tone="accent" title="Vehicle nominated for the evaluation scenario">
                designated: {designated}
              </Badge>
            )}
            <Button size="sm" onClick={designate} disabled={!plate.trim()}>
              Designate for evaluation
            </Button>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded border border-alarm-500/50 bg-alarm-500/10 px-2.5 py-1.5 text-[11px] text-alarm-400">
            {error}
          </p>
        )}
      </Panel>

      {busy && <Spinner label="Querying detections across the federated network" />}

      {result && !busy && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Camera hits" value={result.summary.hits} sub={`${result.summary.cameras} distinct cameras`} tone="accent" />
            <Stat label="Departments crossed" value={result.summary.departments} sub={result.summary.districts.slice(0, 3).join(", ") || "—"} />
            <Stat label="Route distance" value={`${result.summary.totalKm} km`} sub="sum of great-circle legs" />
            <Stat
              label="Time window"
              value={`${Math.round(result.summary.durationMinutes)} min`}
              sub={result.summary.firstSeen ? `${ist(result.summary.firstSeen)} → ${ist(result.summary.lastSeen!)}` : "—"}
            />
            <Stat
              label="Flagged legs"
              value={result.summary.flaggedLegs}
              sub="physically implausible transitions"
              tone={result.summary.flaggedLegs ? "alarm" : "ok"}
            />
            <Stat
              label="Watchlist"
              value={result.summary.watchlisted ? "HIT" : "clear"}
              sub={result.summary.watchlistCategory?.replace(/_/g, " ") ?? "not on watchlist"}
              tone={result.summary.watchlisted ? "alarm" : "ok"}
            />
          </div>

          {result.summary.hits === 0 ? (
            <Empty>
              No detections for {result.query} in this window. Try widening the time range or enabling OCR-variant
              matching.
            </Empty>
          ) : (
            <div className="grid gap-3 xl:grid-cols-[1fr_460px]">
              <Panel
                title={`Route — ${result.query}`}
                subtitle="Numbered in chronological order. Dashed red legs failed the plausibility check."
                bodyClassName="p-2"
                actions={
                  <div className="flex gap-1.5">
                    <a href={`/api/reports/trace?plate=${encodeURIComponent(result.query)}${fuzzy ? "&fuzzy=true" : ""}`}>
                      <Button size="sm">Export CSV</Button>
                    </a>
                    <Button size="sm" variant="ghost" onClick={() => window.print()}>
                      Print / PDF
                    </Button>
                  </div>
                }
              >
                <MapView markers={markers} route={route} height={520} />
              </Panel>

              <div className="space-y-3">
                <Panel title="Movement timeline" subtitle="Every hit, with the evidence reference" bodyClassName="p-0">
                  <div className="max-h-[420px] overflow-y-auto">
                    <ol className="divide-y divide-ink-800">
                      {result.hops.map((h, i) => (
                        <li key={h.detectionId} className="px-3 py-2">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-saffron-500/50 bg-saffron-500/10 font-mono text-[10px] text-saffron-300">
                              {i + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-2">
                                <span className="truncate text-[12px] text-mist-100">{h.cameraName}</span>
                                <Badge tone="neutral">{h.deptName}</Badge>
                                {h.fuzzy && <Badge tone="warn">OCR variant: {h.plateRead}</Badge>}
                              </div>
                              <div className="text-[10.5px] text-mist-400">
                                {h.site} · {h.district}
                              </div>
                              <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[10.5px] text-mist-300">
                                <span>{ist(h.timestamp)} IST</span>
                                <span>{Math.round(h.confidence * 100)}%</span>
                                {h.direction && <span>{h.direction}</span>}
                                {h.speedKph !== undefined && <span>{h.speedKph} km/h</span>}
                              </div>
                              {h.leg && (
                                <div
                                  className={`mt-1 rounded border px-1.5 py-1 text-[10px] ${
                                    h.leg.plausible
                                      ? "border-ink-700 bg-ink-900/60 text-mist-400"
                                      : "border-alarm-500/50 bg-alarm-500/10 text-alarm-400"
                                  }`}
                                >
                                  Leg from #{i}: {h.leg.km} km in {h.leg.minutes} min → {h.leg.impliedKph} km/h
                                  {h.leg.reason ? ` — ${h.leg.reason}` : ""}
                                </div>
                              )}
                              <div className="mt-0.5 truncate font-mono text-[9.5px] text-mist-400/80">{h.frameRef}</div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </Panel>

                {result.predictedNext?.length > 0 && (
                  <Panel
                    title="Nearest cameras to the last sighting"
                    subtitle="Where to watch next, ranked by distance from the final hit"
                    bodyClassName="p-0"
                  >
                    <Table>
                      <thead>
                        <tr>
                          <Th>Camera</Th>
                          <Th>Site</Th>
                          <Th className="text-right">Distance</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.predictedNext.map((p) => (
                          <tr key={p.camera.id}>
                            <Td className="font-mono">{p.camera.id}</Td>
                            <Td className="max-w-56 truncate">{p.camera.site}</Td>
                            <Td className="text-right font-mono">{p.km} km</Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Panel>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
