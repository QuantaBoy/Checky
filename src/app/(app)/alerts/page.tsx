"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertQueue } from "@/components/AlertQueue";
import { MapView, type MapMarker } from "@/components/MapView";
import { Panel, Spinner, Stat } from "@/components/ui";
import { useAlertFeed } from "@/components/useLive";
import type { Camera } from "@/lib/types";

export default function AlertsPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const { alerts, connected, setAlerts } = useAlertFeed(200);

  useEffect(() => {
    fetch("/api/cameras")
      .then((r) => r.json())
      .then((d) => setCameras(d.cameras ?? []))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(
    () => ({
      open: alerts.filter((a) => a.status === "new").length,
      ack: alerts.filter((a) => a.status === "acknowledged").length,
      dispatched: alerts.filter((a) => a.status === "dispatched").length,
      critical: alerts.filter((a) => a.severity === "critical").length,
    }),
    [alerts],
  );

  const markers: MapMarker[] = useMemo(
    () =>
      alerts.slice(0, 120).map((a) => ({
        id: a.id,
        lat: a.evidence.location.lat,
        lng: a.evidence.location.lng,
        label: `${a.evidence.plate} · ${a.severity}`,
        tone: a.status === "new" ? "alarm" : a.status === "acknowledged" ? "warn" : "muted",
        detail: [a.evidence.location.site, new Date(a.evidence.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })],
      })),
    [alerts],
  );

  if (loading) return <Spinner label="Loading alert queue" />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="New" value={counts.open} tone={counts.open ? "alarm" : "neutral"} />
        <Stat label="Acknowledged" value={counts.ack} tone="warn" />
        <Stat label="Dispatched" value={counts.dispatched} tone="ok" />
        <Stat label="Critical (all states)" value={counts.critical} tone="alarm" />
      </div>

      <div className="grid gap-3 xl:grid-cols-[420px_1fr]">
        <AlertQueue
          alerts={alerts}
          cameras={cameras}
          connected={connected}
          max={200}
          onChanged={(u) => setAlerts((prev) => prev.map((a) => (a.id === u.id ? { ...a, ...u } : a)))}
        />
        <Panel
          title="Alert geography"
          subtitle="Where watchlist matches are being generated — red markers are unhandled"
          bodyClassName="p-2"
        >
          <MapView markers={markers} height={620} />
        </Panel>
      </div>
    </div>
  );
}
