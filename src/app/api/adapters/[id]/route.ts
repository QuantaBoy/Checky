import { NextRequest } from "next/server";
import { fail, guard, isResponse, json } from "@/lib/api";
import { store } from "@/lib/store";
import type { Adapter } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const g = await guard("adapter.read");
  if (isResponse(g)) return g;
  const { id } = await ctx.params;
  const a = store.data.adapters.find((x) => x.id === id);
  if (!a) return fail(404, `Adapter '${id}' not found`);
  if (g.scope && a.deptId !== g.scope) return fail(403, "Adapter belongs to another department");
  return json({
    adapter: a,
    cameras: a.cameraIds.map((cid) => store.camera(cid)).filter(Boolean),
    dept: store.data.departments.find((d) => d.id === a.deptId),
  });
}

/** Credential rotation / adapter configuration (FR19). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const g = await guard("adapter.write");
  if (isResponse(g)) return g;
  const { id } = await ctx.params;
  const a = store.data.adapters.find((x) => x.id === id);
  if (!a) return fail(404, `Adapter '${id}' not found`);
  if (g.scope && a.deptId !== g.scope) return fail(403, "Adapter belongs to another department");

  const body = (await req.json().catch(() => null)) as Partial<Adapter> | null;
  if (!body) return fail(400, "Body must be JSON");

  // Only a vault reference may be stored. A literal secret posted here is rejected
  // rather than silently persisted in application state.
  if (body.credentialsRef && !/^vault:\/\//.test(body.credentialsRef)) {
    return fail(400, "credentialsRef must be a vault:// reference — raw secrets are never stored by the platform");
  }
  const patch: Partial<Adapter> = {};
  if (body.credentialsRef) patch.credentialsRef = body.credentialsRef;
  if (body.name) patch.name = body.name;
  if (body.version) patch.version = body.version;
  Object.assign(a, patch);

  store.audit({
    actor: g.session.username,
    role: g.session.role,
    action: "adapter.update",
    entity: "Adapter",
    entityId: a.id,
    detail: `Updated ${Object.keys(patch).join(", ") || "(none)"}`,
  });
  return json({ adapter: a });
}
