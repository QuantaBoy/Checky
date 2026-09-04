import { NextRequest } from "next/server";
import { adapterFor } from "@/lib/adapters";
import { fail, guard, isResponse, json } from "@/lib/api";
import { bus } from "@/lib/bus";
import { store } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Re-probe a camera through its adapter (Flow A step 6 retry path).
 *
 * `?live=true` forces a genuine TCP probe of the endpoint instead of the mock
 * adapter, and the result reports which adapter answered so nobody mistakes a
 * simulated heartbeat for a real one.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const g = await guard("camera.write");
  if (isResponse(g)) return g;
  const { id } = await ctx.params;
  const cam = store.camera(id);
  if (!cam) return fail(404, `Camera '${id}' not found`);
  if (g.scope && cam.deptId !== g.scope) return fail(403, "Camera belongs to another department");

  const live = req.nextUrl.searchParams.get("live") === "true";
  const adapter = adapterFor(cam, live);
  const probe = await adapter.testConnection(cam);
  const normalized = adapter.normalizeHealth(cam, probe.raw);

  cam.status = probe.reachable ? normalized.status : "unreachable";
  cam.lastHeartbeat = probe.reachable ? new Date().toISOString() : cam.lastHeartbeat;
  bus.publish("camera.health", { cameraId: cam.id, status: cam.status, deptId: cam.deptId, at: new Date().toISOString() });

  store.audit({
    actor: g.session.username,
    role: g.session.role,
    action: "camera.connection_test",
    entity: "Camera",
    entityId: cam.id,
    detail: `${adapter.kind} adapter probe → ${probe.reachable ? "reachable" : "unreachable"} (${probe.detail})`,
  });

  return json({
    camera: cam,
    adapterKind: adapter.kind,
    simulated: adapter.kind === "mock",
    probe,
    normalized,
    streamUrl: adapter.streamUrl(cam),
  });
}
