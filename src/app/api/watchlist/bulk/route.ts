import { NextRequest } from "next/server";
import { fail, guard, isResponse, json } from "@/lib/api";
import { backfillCorrelation } from "@/lib/correlation";
import { WATCHLIST_CSV_TEMPLATE, parseCsv } from "@/lib/csv";
import { normalizePlate, store } from "@/lib/store";
import type { WatchlistCategory, WatchlistEntry, WatchlistSeverity } from "@/lib/types";

export async function GET() {
  const g = await guard("watchlist.write");
  if (isResponse(g)) return g;
  return new Response(WATCHLIST_CSV_TEMPLATE, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="sentinel-watchlist-template.csv"',
    },
  });
}

/** Bulk watchlist import (Flow E step 3) — representative datasets for the demo. */
export async function POST(req: NextRequest) {
  const g = await guard("watchlist.write");
  if (isResponse(g)) return g;
  const body = (await req.json().catch(() => null)) as { csv?: string } | null;
  if (!body?.csv) return fail(400, "Expected { csv: string }");
  const rows = parseCsv(body.csv);
  if (!rows.length) return fail(400, "CSV contained no data rows");

  const accepted: WatchlistEntry[] = [];
  const rejected: { line: number; reason: string }[] = [];
  let historic = 0;

  rows.forEach((r, i) => {
    const line = i + 2;
    if (!r.value?.trim()) return rejected.push({ line, reason: "value is required" });
    const kind = r.kind?.trim() === "person" ? "person" : "vehicle";
    const value = kind === "vehicle" ? normalizePlate(r.value) : r.value.trim();
    if (kind === "vehicle" && !/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/.test(value)) {
      return rejected.push({ line, reason: `'${r.value}' is not a recognisable registration number` });
    }
    if (store.data.watchlist.some((w) => w.kind === kind && normalizePlate(w.value) === normalizePlate(value))) {
      return rejected.push({ line, reason: `'${value}' is already on the watchlist` });
    }
    const entry: WatchlistEntry = {
      id: store.nextWatchlistId(),
      kind,
      category: (r.category?.trim() as WatchlistCategory) || (kind === "person" ? "wanted_person" : "stolen_vehicle"),
      value,
      description: r.description?.trim() ?? "",
      severity: (r.severity?.trim() as WatchlistSeverity) || "high",
      source: r.source?.trim() || "CSV import",
      caseRef: r.case_ref?.trim() || "—",
      addedBy: g.session.name,
      addedAt: new Date().toISOString(),
      active: true,
    };
    store.data.watchlist.push(entry);
    historic += backfillCorrelation(entry);
    accepted.push(entry);
  });

  store.audit({
    actor: g.session.username,
    role: g.session.role,
    action: "watchlist.bulk_import",
    entity: "WatchlistEntry",
    entityId: `${accepted.length} entries`,
    detail: `CSV import: ${accepted.length} accepted, ${rejected.length} rejected, ${historic} historic match(es) raised`,
  });

  return json({ accepted: accepted.length, rejected, historicMatches: historic }, { status: 201 });
}
