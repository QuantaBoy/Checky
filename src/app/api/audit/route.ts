import { NextRequest } from "next/server";
import { guard, isResponse, json } from "@/lib/api";
import { store } from "@/lib/store";

export async function GET(req: NextRequest) {
  const g = await guard("audit.read");
  if (isResponse(g)) return g;
  const q = req.nextUrl.searchParams;
  const action = q.get("action");
  const actor = q.get("actor");
  const search = q.get("q")?.toLowerCase();
  const limit = Math.min(Number(q.get("limit") ?? 300) || 300, 2000);

  let rows = [...store.data.audit].reverse();
  if (action) rows = rows.filter((r) => r.action.startsWith(action));
  if (actor) rows = rows.filter((r) => r.actor === actor);
  if (search) rows = rows.filter((r) => `${r.action} ${r.entity} ${r.entityId} ${r.detail} ${r.actor}`.toLowerCase().includes(search));

  return json({
    audit: rows.slice(0, limit),
    total: rows.length,
    // Integrity of the log is itself evidence: if the chain is broken, say which
    // entry broke it rather than presenting the log as trustworthy.
    chain: store.verifyAuditChain(),
    actions: [...new Set(store.data.audit.map((r) => r.action))].sort(),
    actors: [...new Set(store.data.audit.map((r) => r.actor))].sort(),
  });
}
