import { NextRequest } from "next/server";
import { guard, isResponse } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import { store } from "@/lib/store";

/**
 * Test-scenario deliverable 4: "output report of detected vehicles/plates with
 * timestamps for the government-provided feed."
 */
export async function GET(req: NextRequest) {
  const g = await guard("report.export");
  if (isResponse(g)) return g;
  const q = req.nextUrl.searchParams;
  const cameraId = q.get("camera");
  const since = q.get("since");
  const sinceMs = since ? new Date(since).getTime() : Date.now() - 8 * 3600_000;
  const visible = g.scope
    ? new Set(store.data.cameras.filter((c) => c.deptId === g.scope).map((c) => c.id))
    : null;

  const rows = store.data.detections
    .filter((d) => d.type === "plate")
    .filter((d) => (visible ? visible.has(d.cameraId) : true))
    .filter((d) => (cameraId ? d.cameraId === cameraId : true))
    .filter((d) => new Date(d.timestamp).getTime() >= sinceMs)
    .map((d) => {
      const cam = store.camera(d.cameraId);
      const dept = store.data.departments.find((x) => x.id === cam?.deptId);
      const wl = store.data.watchlist.find(
        (w) => w.kind === "vehicle" && w.value.toUpperCase() === d.value.toUpperCase(),
      );
      return {
        timestamp_ist: new Date(d.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        timestamp_utc: d.timestamp,
        plate: d.value,
        confidence: d.confidence,
        camera_id: d.cameraId,
        camera_name: cam?.name ?? "",
        site: cam?.site ?? "",
        district: cam?.district ?? "",
        latitude: cam?.lat ?? "",
        longitude: cam?.lng ?? "",
        department: dept?.shortName ?? "",
        vms_vendor: cam?.vendor ?? "",
        direction: d.direction ?? "",
        speed_kph: d.speedKph ?? "",
        vehicle_type: d.vehicleType ?? "",
        vehicle_colour: d.vehicleColor ?? "",
        watchlist_hit: wl ? "YES" : "NO",
        watchlist_category: wl?.category ?? "",
        case_ref: wl?.caseRef ?? "",
        evidence_frame: d.frameRef,
        detection_source: d.source,
      };
    });

  store.audit({
    actor: g.session.username,
    role: g.session.role,
    action: "report.export",
    entity: "DetectionReport",
    entityId: cameraId ?? "all-cameras",
    detail: `Exported ${rows.length} plate detections since ${new Date(sinceMs).toISOString()}`,
  });

  const filename = `sentinel-detections-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.csv`;
  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
