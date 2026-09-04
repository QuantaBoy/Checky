import { NextRequest } from "next/server";
import { adapterFor } from "@/lib/adapters";
import { fail, guard, isResponse, json, scoped } from "@/lib/api";
import { attachToAdapter } from "@/lib/onboard";
import { store } from "@/lib/store";
import type { Camera } from "@/lib/types";

export async function GET(req: NextRequest) {
  const g = await guard("camera.read");
  if (isResponse(g)) return g;
  const q = req.nextUrl.searchParams;
  let rows = scoped(store.data.cameras, g.scope);

  const dept = q.get("dept");
  const status = q.get("status");
  const type = q.get("type");
  const district = q.get("district");
  const search = q.get("q")?.toLowerCase();
  const anpr = q.get("anpr");

  if (dept) rows = rows.filter((c) => c.deptId === dept);
  if (status) rows = rows.filter((c) => c.status === status);
  if (type) rows = rows.filter((c) => c.type === type);
  if (district) rows = rows.filter((c) => c.district === district);
  if (anpr === "true") rows = rows.filter((c) => c.anprEnabled);
  if (search) {
    rows = rows.filter((c) =>
      [c.id, c.name, c.site, c.district, c.vendor, c.model].some((v) => v.toLowerCase().includes(search)),
    );
  }
  return json({
    cameras: rows,
    total: rows.length,
    departments: store.data.departments,
    districts: [...new Set(store.data.cameras.map((c) => c.district))].sort(),
    scope: g.scope,
  });
}

/** Manual + API-based onboarding (FR1 / Flow A). */
export async function POST(req: NextRequest) {
  const g = await guard("camera.write");
  if (isResponse(g)) return g;
  const body = (await req.json().catch(() => null)) as Partial<Camera> & { testConnection?: boolean } | null;
  if (!body) return fail(400, "Body must be JSON");

  const deptId = g.scope ?? body.deptId;
  if (!deptId) return fail(400, "deptId is required");
  if (g.scope && body.deptId && body.deptId !== g.scope) {
    return fail(403, "Department admins may only onboard cameras into their own department");
  }
  if (!store.data.departments.some((d) => d.id === deptId)) return fail(400, `Unknown department '${deptId}'`);

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || lat < 6 || lat > 38) return fail(400, "lat must be a number within India's latitude range");
  if (!Number.isFinite(lng) || lng < 68 || lng > 98) return fail(400, "lng must be a number within India's longitude range");
  if (!body.name?.trim()) return fail(400, "name is required");
  if (!body.endpoint?.trim()) return fail(400, "endpoint is required");

  const dept = store.data.departments.find((d) => d.id === deptId)!;
  const cam: Camera = {
    id: store.nextCameraId(),
    name: body.name.trim(),
    deptId,
    lat,
    lng,
    district: body.district?.trim() || dept.district,
    site: body.site?.trim() || body.name.trim(),
    type: body.type ?? "fixed",
    vendor: body.vendor?.trim() || dept.vmsVendor,
    model: body.model?.trim() || "unspecified",
    analog: Boolean(body.analog),
    protocol: body.protocol ?? "rtsp",
    endpoint: body.endpoint.trim(),
    streamUrl: body.streamUrl?.trim() || undefined,
    storageType: body.storageType ?? "local_nvr",
    retentionDays: Number(body.retentionDays) > 0 ? Number(body.retentionDays) : 30,
    status: "unreachable",
    bearing: Number.isFinite(Number(body.bearing)) ? Number(body.bearing) : 0,
    fovDeg: Number(body.fovDeg) > 0 ? Number(body.fovDeg) : 90,
    installedAt: body.installedAt ?? new Date().toISOString(),
    onboardedAt: new Date().toISOString(),
    lastHeartbeat: null,
    anprEnabled: Boolean(body.anprEnabled),
    notes: body.notes,
  };

  // Flow A step 4: probe before accepting. A camera that cannot be reached is still
  // registered — it just lands in the gap-analysis report instead of the video wall.
  let probe = null;
  if (body.testConnection !== false) {
    const adapter = adapterFor(cam, true);
    probe = await adapter.testConnection(cam);
    cam.status = probe.reachable ? "online" : "unreachable";
    if (probe.reachable) cam.lastHeartbeat = new Date().toISOString();
  }

  store.addCamera(cam);
  attachToAdapter(cam);
  store.audit({
    actor: g.session.username,
    role: g.session.role,
    action: "camera.onboard",
    entity: "Camera",
    entityId: cam.id,
    detail: `${cam.name} onboarded to ${dept.shortName} via ${cam.protocol.toUpperCase()} — status ${cam.status}${probe ? ` (${probe.detail})` : ""}`,
  });
  return json({ camera: cam, probe }, { status: 201 });
}
