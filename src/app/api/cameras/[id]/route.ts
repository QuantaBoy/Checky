import { NextRequest } from "next/server";
import { fail, guard, isResponse, json } from "@/lib/api";
import { store } from "@/lib/store";
import type { Camera } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const g = await guard("camera.read");
  if (isResponse(g)) return g;
  const { id } = await ctx.params;
  const cam = store.camera(id);
  if (!cam) return fail(404, `Camera '${id}' not found`);
  if (g.scope && cam.deptId !== g.scope) return fail(403, "Camera belongs to another department");

  const dept = store.data.departments.find((d) => d.id === cam.deptId);
  const adapter = store.data.adapters.find((a) => a.cameraIds.includes(cam.id));
  const detections = store.data.detections
    .filter((d) => d.cameraId === cam.id)
    .slice(-80)
    .reverse();
  const alerts = store.data.alerts.filter((a) => a.cameraId === cam.id).slice(0, 25);
  return json({ camera: cam, department: dept, adapter, detections, alerts });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const g = await guard("camera.write");
  if (isResponse(g)) return g;
  const { id } = await ctx.params;
  const cam = store.camera(id);
  if (!cam) return fail(404, `Camera '${id}' not found`);
  if (g.scope && cam.deptId !== g.scope) return fail(403, "Camera belongs to another department");

  const body = (await req.json().catch(() => null)) as Partial<Camera> | null;
  if (!body) return fail(400, "Body must be JSON");
  // deptId is deliberately not patchable: moving a camera between departments would
  // move it out of its owner's RBAC scope in one request.
  const { id: _ignored, deptId: _ignored2, ...patch } = body;
  store.updateCamera(id, patch);
  store.audit({
    actor: g.session.username,
    role: g.session.role,
    action: "camera.update",
    entity: "Camera",
    entityId: id,
    detail: `Updated fields: ${Object.keys(patch).join(", ") || "(none)"}`,
  });
  return json({ camera: store.camera(id) });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const g = await guard("camera.delete");
  if (isResponse(g)) return g;
  const { id } = await ctx.params;
  const cam = store.camera(id);
  if (!cam) return fail(404, `Camera '${id}' not found`);
  if (g.scope && cam.deptId !== g.scope) return fail(403, "Camera belongs to another department");
  store.removeCamera(id);
  store.audit({
    actor: g.session.username,
    role: g.session.role,
    action: "camera.decommission",
    entity: "Camera",
    entityId: id,
    detail: `${cam.name} (${cam.site}) removed from the registry`,
  });
  return json({ ok: true });
}
