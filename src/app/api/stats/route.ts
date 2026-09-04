import { guard, isResponse, json, scoped } from "@/lib/api";
import { bus } from "@/lib/bus";
import { engine } from "@/lib/engine";
import { store } from "@/lib/store";

/** Platform-wide counters for the dashboard header and the architecture page. */
export async function GET() {
  const g = await guard("camera.read");
  if (isResponse(g)) return g;
  const e = engine();
  const cameras = scoped(store.data.cameras, g.scope);
  const visible = new Set(cameras.map((c) => c.id));
  const alerts = scoped(store.data.alerts, g.scope);
  const now = Date.now();
  const lastHour = store.data.detections.filter(
    (d) => visible.has(d.cameraId) && now - new Date(d.timestamp).getTime() < 3600_000,
  );

  return json({
    cameras: {
      total: cameras.length,
      online: cameras.filter((c) => c.status === "online").length,
      degraded: cameras.filter((c) => c.status === "degraded").length,
      offline: cameras.filter((c) => c.status === "offline" || c.status === "unreachable").length,
      anpr: cameras.filter((c) => c.anprEnabled).length,
      analog: cameras.filter((c) => c.analog).length,
    },
    departments: g.scope ? 1 : store.data.departments.length,
    adapters: scoped(store.data.adapters, g.scope).length,
    watchlist: {
      total: store.data.watchlist.length,
      active: store.data.watchlist.filter((w) => w.active).length,
      vehicles: store.data.watchlist.filter((w) => w.kind === "vehicle").length,
      persons: store.data.watchlist.filter((w) => w.kind === "person").length,
    },
    detections: {
      stored: store.data.detections.length,
      lastHour: lastHour.length,
      plates: lastHour.filter((d) => d.type === "plate").length,
      uniquePlatesLastHour: new Set(lastHour.filter((d) => d.type === "plate").map((d) => d.value)).size,
    },
    alerts: {
      total: alerts.length,
      new: alerts.filter((a) => a.status === "new").length,
      critical: alerts.filter((a) => a.severity === "critical" && a.status === "new").length,
    },
    bus: bus.stats(),
    engine: {
      detectionSource: e.source.name,
      simulated: true,
      running: e.source.running(),
      startedAt: e.startedAt,
      bootedAt: store.data.bootedAt,
    },
    designatedVehicle: store.data.designatedVehicle,
    audit: store.verifyAuditChain(),
  });
}
