import { NextRequest } from "next/server";
import { fail, guard, isResponse, json } from "@/lib/api";
import { backfillCorrelation } from "@/lib/correlation";
import { store } from "@/lib/store";
import type { WatchlistEntry } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const g = await guard("watchlist.read");
  if (isResponse(g)) return g;
  const { id } = await ctx.params;
  const entry = store.watchlistEntry(id);
  if (!entry) return fail(404, `Watchlist entry '${id}' not found`);
  const alerts = store.data.alerts.filter((a) => a.watchlistEntryId === id);
  return json({ entry, alerts, matchCount: alerts.length });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const g = await guard("watchlist.write");
  if (isResponse(g)) return g;
  const { id } = await ctx.params;
  const entry = store.watchlistEntry(id);
  if (!entry) return fail(404, `Watchlist entry '${id}' not found`);
  const body = (await req.json().catch(() => null)) as Partial<WatchlistEntry> | null;
  if (!body) return fail(400, "Body must be JSON");
  const wasActive = entry.active;
  const { id: _drop, addedAt: _drop2, addedBy: _drop3, ...patch } = body;
  Object.assign(entry, patch);

  let historic = 0;
  if (!wasActive && entry.active) historic = backfillCorrelation(entry);

  store.audit({
    actor: g.session.username,
    role: g.session.role,
    action: "watchlist.update",
    entity: "WatchlistEntry",
    entityId: id,
    detail: `Updated ${Object.keys(patch).join(", ") || "(none)"}${historic ? `; ${historic} historic match(es) raised on reactivation` : ""}`,
  });
  return json({ entry, historicMatches: historic });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const g = await guard("watchlist.write");
  if (isResponse(g)) return g;
  const { id } = await ctx.params;
  const i = store.data.watchlist.findIndex((w) => w.id === id);
  if (i < 0) return fail(404, `Watchlist entry '${id}' not found`);
  const [removed] = store.data.watchlist.splice(i, 1);
  store.audit({
    actor: g.session.username,
    role: g.session.role,
    action: "watchlist.remove",
    entity: "WatchlistEntry",
    entityId: id,
    detail: `${removed.category} '${removed.value}' removed (case ${removed.caseRef})`,
  });
  return json({ ok: true });
}
