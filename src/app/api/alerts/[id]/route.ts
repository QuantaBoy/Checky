import { NextRequest } from "next/server";
import { fail, guard, isResponse, json } from "@/lib/api";
import { bus } from "@/lib/bus";
import { store } from "@/lib/store";
import type { AlertStatus } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED: AlertStatus[] = ["new", "acknowledged", "dispatched", "closed"];

/** Operator action on an alert (Flow B step 6). Every transition is audited. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const g = await guard("alert.action");
  if (isResponse(g)) return g;
  const { id } = await ctx.params;
  const alert = store.alert(id);
  if (!alert) return fail(404, `Alert '${id}' not found`);
  if (g.scope && alert.deptId !== g.scope) return fail(403, "Alert belongs to another department");

  const body = (await req.json().catch(() => null)) as { status?: AlertStatus; note?: string } | null;
  if (!body?.status || !ALLOWED.includes(body.status)) {
    return fail(400, `status must be one of: ${ALLOWED.join(", ")}`);
  }

  const previous = alert.status;
  alert.status = body.status;
  alert.handledBy = g.session.name;
  alert.handledAt = new Date().toISOString();
  if (body.note) alert.note = body.note;

  store.audit({
    actor: g.session.username,
    role: g.session.role,
    action: `alert.${body.status}`,
    entity: "Alert",
    entityId: alert.id,
    detail: `${previous} → ${body.status} on ${alert.evidence.plate} at ${alert.evidence.location.site}${body.note ? ` — ${body.note}` : ""}`,
  });
  bus.publish("alert.updated", alert);
  return json({ alert });
}
