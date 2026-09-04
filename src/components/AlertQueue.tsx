"use client";

import Link from "next/link";
import { useState } from "react";
import type { Camera } from "@/lib/types";
import type { EnrichedAlert } from "./useLive";
import { Badge, Button, Empty, Panel, StatusDot, ist, severityTone, timeAgo } from "./ui";

/**
 * The operator's alert queue (Flow B step 5–6).
 *
 * Every alert carries its evidence — frame reference, plate as read, camera, time and
 * confidence — because an acknowledgement without the evidence in front of the
 * operator is just a click.
 */
export function AlertQueue({
  alerts,
  cameras,
  connected,
  onChanged,
  onJump,
  showFilters = true,
  max = 40,
}: {
  alerts: EnrichedAlert[];
  cameras: Camera[];
  connected: boolean;
  onChanged?: (a: EnrichedAlert) => void;
  onJump?: (cameraId: string) => void;
  showFilters?: boolean;
  max?: number;
}) {
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [busy, setBusy] = useState<string | null>(null);

  const rows = alerts.filter((a) => (filter === "open" ? a.status === "new" || a.status === "acknowledged" : true)).slice(0, max);

  const act = async (id: string, status: "acknowledged" | "dispatched" | "closed") => {
    setBusy(id);
    try {
      const res = await fetch(`/api/alerts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const { alert } = await res.json();
        onChanged?.(alert);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      title="Alert queue"
      subtitle="watchlist.match → alert.raised, pushed live"
      actions={
        <div className="flex items-center gap-1.5">
          {showFilters && (
            <>
              <Button size="sm" variant={filter === "open" ? "primary" : "ghost"} onClick={() => setFilter("open")}>
                Open
              </Button>
              <Button size="sm" variant={filter === "all" ? "primary" : "ghost"} onClick={() => setFilter("all")}>
                All
              </Button>
            </>
          )}
          <Badge tone={connected ? "ok" : "alarm"}>
            <StatusDot tone={connected ? "ok" : "alarm"} pulse={connected} />
            {connected ? "live" : "offline"}
          </Badge>
        </div>
      }
      bodyClassName="p-0"
    >
      <div className="max-h-[560px] overflow-y-auto">
        {!rows.length && <Empty>No {filter === "open" ? "open " : ""}alerts. Correlation engine is running.</Empty>}
        <ul className="divide-y divide-ink-800">
          {rows.map((a) => {
            const cam = cameras.find((c) => c.id === a.cameraId);
            return (
              <li key={a.id} className="animate-slide-in px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={severityTone(a.severity)}>{a.severity}</Badge>
                      <span className="font-mono text-[13px] text-mist-100">{a.evidence.plate}</span>
                      {a.status !== "new" && <Badge tone="neutral">{a.status}</Badge>}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-mist-300">
                      {(a.watchlistCategory ?? "").replace(/_/g, " ") || "watchlist match"}
                      {a.caseRef && a.caseRef !== "—" ? ` · ${a.caseRef}` : ""}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-mist-400">{timeAgo(a.createdAt)}</span>
                </div>

                <div className="mt-1.5 rounded border border-ink-700 bg-ink-900/60 px-2 py-1.5">
                  <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10.5px]">
                    <span className="text-mist-400">Camera</span>
                    <span className="truncate text-mist-200">
                      {a.cameraName ?? cam?.name ?? a.cameraId}
                      {cam ? ` · ${cam.district}` : ""}
                    </span>
                    <span className="text-mist-400">Location</span>
                    <span className="truncate text-mist-200">{a.evidence.location.site}</span>
                    <span className="text-mist-400">Seen at</span>
                    <span className="font-mono text-mist-200">{ist(a.evidence.timestamp)}</span>
                    <span className="text-mist-400">Confidence</span>
                    <span className="font-mono text-mist-200">{Math.round(a.confidence * 100)}%</span>
                    <span className="text-mist-400">Evidence</span>
                    <span className="truncate font-mono text-[9.5px] text-mist-400">{a.evidence.frameRef}</span>
                  </div>
                  {a.note && <p className="mt-1 text-[10px] text-warn-500">{a.note}</p>}
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {a.status === "new" && (
                    <Button size="sm" onClick={() => act(a.id, "acknowledged")} disabled={busy === a.id}>
                      Acknowledge
                    </Button>
                  )}
                  {a.status !== "dispatched" && a.status !== "closed" && (
                    <Button size="sm" variant="danger" onClick={() => act(a.id, "dispatched")} disabled={busy === a.id}>
                      Dispatch unit
                    </Button>
                  )}
                  {a.status !== "closed" && (
                    <Button size="sm" variant="ghost" onClick={() => act(a.id, "closed")} disabled={busy === a.id}>
                      Close
                    </Button>
                  )}
                  {onJump && (
                    <Button size="sm" variant="ghost" onClick={() => onJump(a.cameraId)}>
                      Show feed
                    </Button>
                  )}
                  <Link href={`/trace?plate=${encodeURIComponent(a.evidence.plate)}`} className="ml-auto">
                    <Button size="sm" variant="ghost">
                      Trace vehicle →
                    </Button>
                  </Link>
                </div>

                {a.handledBy && (
                  <p className="mt-1 text-[9.5px] text-mist-400">
                    {a.status} by {a.handledBy} · {ist(a.handledAt)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}
