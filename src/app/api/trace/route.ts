import { NextRequest } from "next/server";
import { fail, guard, isResponse, json } from "@/lib/api";
import { store } from "@/lib/store";
import { predictNext, traceVehicle } from "@/lib/trace";

/** Flow C — vehicle movement reconstruction across the federated network. */
export async function GET(req: NextRequest) {
  const g = await guard("trace.read");
  if (isResponse(g)) return g;
  const q = req.nextUrl.searchParams;
  const plate = q.get("plate")?.trim();
  if (!plate) return fail(400, "plate is required");

  const result = traceVehicle({
    plate,
    fuzzy: q.get("fuzzy") === "true",
    from: q.get("from"),
    to: q.get("to"),
    deptId: g.scope,
  });

  store.audit({
    actor: g.session.username,
    role: g.session.role,
    action: "trace.query",
    entity: "Vehicle",
    entityId: plate.toUpperCase(),
    detail: `Route reconstruction returned ${result.summary.hits} hits across ${result.summary.cameras} cameras / ${result.summary.departments} departments${result.summary.flaggedLegs ? `, ${result.summary.flaggedLegs} legs flagged implausible` : ""}`,
  });

  return json({ ...result, predictedNext: predictNext(result) });
}
