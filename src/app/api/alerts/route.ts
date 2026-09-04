import { NextRequest } from "next/server";
import { guard, isResponse, json, scoped } from "@/lib/api";
import { store } from "@/lib/store";

export async function GET(req: NextRequest) {
  const g = await guard("alert.read");
  if (isResponse(g)) return g;
  const q = req.nextUrl.searchParams;
  const status = q.get("status");
  const severity = q.get("severity");
  const limit = Math.min(Number(q.get("limit") ?? 100) || 100, 1000);

  let rows = scoped(store.data.alerts, g.scope);
  if (status) rows = rows.filter((a) => a.status === status);
  if (severity) rows = rows.filter((a) => a.severity === severity);

  const enriched = rows.slice(0, limit).map((a) => {
    const cam = store.camera(a.cameraId);
    const entry = store.watchlistEntry(a.watchlistEntryId);
    return {
      ...a,
      cameraName: cam?.name ?? a.cameraId,
      site: cam?.site ?? "—",
      district: cam?.district ?? "—",
      watchlistValue: entry?.value ?? "—",
      watchlistCategory: entry?.category ?? "—",
      watchlistDescription: entry?.description ?? "",
      caseRef: entry?.caseRef ?? "—",
    };
  });

  return json({
    alerts: enriched,
    total: rows.length,
    counts: {
      new: rows.filter((a) => a.status === "new").length,
      acknowledged: rows.filter((a) => a.status === "acknowledged").length,
      dispatched: rows.filter((a) => a.status === "dispatched").length,
      closed: rows.filter((a) => a.status === "closed").length,
      critical: rows.filter((a) => a.severity === "critical").length,
    },
    scope: g.scope,
  });
}
