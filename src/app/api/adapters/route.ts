import { guard, isResponse, json, scoped } from "@/lib/api";
import { store } from "@/lib/store";

/** Adapter/connector health console (FR19). */
export async function GET() {
  const g = await guard("adapter.read");
  if (isResponse(g)) return g;
  const rows = scoped(store.data.adapters, g.scope).map((a) => {
    const cams = a.cameraIds.map((id) => store.camera(id)).filter(Boolean);
    return {
      ...a,
      // The credential reference is safe to show; the secret itself never leaves the
      // vault and is never sent to a browser.
      cameraCount: cams.length,
      camerasOnline: cams.filter((c) => c!.status === "online").length,
      dept: store.data.departments.find((d) => d.id === a.deptId)?.shortName ?? a.deptId,
    };
  });
  return json({
    adapters: rows,
    total: rows.length,
    summary: {
      healthy: rows.filter((a) => a.health === "healthy").length,
      degraded: rows.filter((a) => a.health === "degraded").length,
      down: rows.filter((a) => a.health === "down").length,
      unconfigured: rows.filter((a) => a.health === "unconfigured").length,
    },
    scope: g.scope,
  });
}
