import { NextRequest } from "next/server";
import { fail, guard, isResponse, json } from "@/lib/api";
import { CAMERA_CSV_TEMPLATE, parseCsv } from "@/lib/csv";
import { attachToAdapter } from "@/lib/onboard";
import { store } from "@/lib/store";
import type { Camera, CameraType, Protocol, StorageType } from "@/lib/types";

/** Download the CSV template a department fills in for bulk onboarding. */
export async function GET() {
  const g = await guard("camera.write");
  if (isResponse(g)) return g;
  return new Response(CAMERA_CSV_TEMPLATE, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="sentinel-camera-onboarding-template.csv"',
    },
  });
}

/**
 * Bulk onboarding (FR1).
 *
 * Rows are validated individually: a bad row is rejected with its line number and
 * reason while the rest of the file still imports. A department inventory of a few
 * hundred cameras always has a handful of malformed rows, and failing the whole
 * upload for one bad latitude is how onboarding stalls in practice.
 */
export async function POST(req: NextRequest) {
  const g = await guard("camera.write");
  if (isResponse(g)) return g;
  const body = (await req.json().catch(() => null)) as { csv?: string } | null;
  if (!body?.csv) return fail(400, "Expected { csv: string }");

  const rows = parseCsv(body.csv);
  if (!rows.length) return fail(400, "CSV contained no data rows");

  const accepted: Camera[] = [];
  const rejected: { line: number; reason: string; row: Record<string, string> }[] = [];

  rows.forEach((r, i) => {
    const line = i + 2; // header is line 1
    const deptId = g.scope ?? (r.dept_id || r.department || "").toUpperCase();
    if (!deptId) return rejected.push({ line, reason: "dept_id is required", row: r });
    if (g.scope && r.dept_id && r.dept_id.toUpperCase() !== g.scope) {
      return rejected.push({ line, reason: `Row targets ${r.dept_id} but this account is scoped to ${g.scope}`, row: r });
    }
    const dept = store.data.departments.find((d) => d.id === deptId);
    if (!dept) return rejected.push({ line, reason: `Unknown department '${deptId}'`, row: r });
    if (!r.name?.trim()) return rejected.push({ line, reason: "name is required", row: r });

    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (!Number.isFinite(lat) || lat < 6 || lat > 38) {
      return rejected.push({ line, reason: `lat '${r.lat}' is not a valid Indian latitude`, row: r });
    }
    if (!Number.isFinite(lng) || lng < 68 || lng > 98) {
      return rejected.push({ line, reason: `lng '${r.lng}' is not a valid Indian longitude`, row: r });
    }
    if (!r.endpoint?.trim()) return rejected.push({ line, reason: "endpoint is required", row: r });
    if (store.data.cameras.some((c) => c.endpoint === r.endpoint.trim())) {
      return rejected.push({ line, reason: `Endpoint already registered to another camera`, row: r });
    }

    const retention = Number(r.retention_days);
    const cam: Camera = {
      id: store.nextCameraId(),
      name: r.name.trim(),
      deptId,
      lat,
      lng,
      district: r.district?.trim() || dept.district,
      site: r.site?.trim() || r.name.trim(),
      type: (r.type?.trim() as CameraType) || "fixed",
      vendor: r.vendor?.trim() || dept.vmsVendor,
      model: r.model?.trim() || "unspecified",
      analog: /^(true|yes|1)$/i.test(r.analog ?? ""),
      protocol: ((r.protocol?.trim().toLowerCase() as Protocol) || "rtsp"),
      endpoint: r.endpoint.trim(),
      storageType: ((r.storage_type?.trim() as StorageType) || "local_nvr"),
      retentionDays: Number.isFinite(retention) && retention > 0 ? retention : 30,
      // Bulk rows are registered pending their first heartbeat; the adapter promotes
      // them to online once it actually reaches the device.
      status: "unreachable",
      bearing: Number.isFinite(Number(r.bearing)) ? Number(r.bearing) : 0,
      fovDeg: 90,
      installedAt: new Date().toISOString(),
      onboardedAt: new Date().toISOString(),
      lastHeartbeat: null,
      anprEnabled: /^(true|yes|1)$/i.test(r.anpr_enabled ?? ""),
    };
    store.addCamera(cam);
    attachToAdapter(cam);
    accepted.push(cam);
  });

  store.audit({
    actor: g.session.username,
    role: g.session.role,
    action: "camera.bulk_onboard",
    entity: "Camera",
    entityId: `${accepted.length} cameras`,
    detail: `CSV bulk import: ${accepted.length} accepted, ${rejected.length} rejected`,
  });

  return json({ accepted: accepted.length, rejected, cameras: accepted }, { status: 201 });
}
