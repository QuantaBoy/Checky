import { NextRequest } from "next/server";
import { fail, guard, isResponse, json } from "@/lib/api";
import { backfillCorrelation } from "@/lib/correlation";
import { normalizePlate, store } from "@/lib/store";
import type { WatchlistCategory, WatchlistEntry, WatchlistSeverity } from "@/lib/types";

const CATEGORIES: WatchlistCategory[] = [
  "stolen_vehicle",
  "blacklisted_vehicle",
  "wanted_person",
  "missing_person",
  "suspect_vehicle",
];
const SEVERITIES: WatchlistSeverity[] = ["critical", "high", "medium", "low"];

export async function GET(req: NextRequest) {
  const g = await guard("watchlist.read");
  if (isResponse(g)) return g;
  const q = req.nextUrl.searchParams;
  const kind = q.get("kind");
  const category = q.get("category");
  const search = q.get("q")?.toLowerCase();

  let rows = [...store.data.watchlist];
  if (kind) rows = rows.filter((w) => w.kind === kind);
  if (category) rows = rows.filter((w) => w.category === category);
  if (search) rows = rows.filter((w) => `${w.value} ${w.description} ${w.caseRef}`.toLowerCase().includes(search));

  // Match counts per entry drive the "match history" view (Flow E step 4).
  const matches = new Map<string, number>();
  for (const a of store.data.alerts) matches.set(a.watchlistEntryId, (matches.get(a.watchlistEntryId) ?? 0) + 1);

  return json({
    watchlist: rows.map((w) => ({ ...w, matchCount: matches.get(w.id) ?? 0 })),
    total: rows.length,
    categories: CATEGORIES,
    severities: SEVERITIES,
  });
}

export async function POST(req: NextRequest) {
  const g = await guard("watchlist.write");
  if (isResponse(g)) return g;
  const b = (await req.json().catch(() => null)) as Partial<WatchlistEntry> | null;
  if (!b) return fail(400, "Body must be JSON");
  if (!b.value?.trim()) return fail(400, "value is required (plate number or person identifier)");
  const kind = b.kind === "person" ? "person" : "vehicle";
  const category = (b.category ?? (kind === "person" ? "wanted_person" : "stolen_vehicle")) as WatchlistCategory;
  if (!CATEGORIES.includes(category)) return fail(400, `Unknown category '${category}'`);

  const value = kind === "vehicle" ? normalizePlate(b.value) : b.value.trim();
  if (kind === "vehicle" && !/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/.test(value)) {
    return fail(400, `'${b.value}' is not a recognisable Indian registration number`);
  }
  if (store.data.watchlist.some((w) => w.kind === kind && normalizePlate(w.value) === normalizePlate(value) && w.active)) {
    return fail(409, `An active watchlist entry already exists for '${value}'`);
  }

  const entry: WatchlistEntry = {
    id: store.nextWatchlistId(),
    kind,
    category,
    value,
    description: b.description?.trim() || "",
    severity: SEVERITIES.includes(b.severity as WatchlistSeverity) ? (b.severity as WatchlistSeverity) : "high",
    source: b.source?.trim() || "Manual entry",
    caseRef: b.caseRef?.trim() || "—",
    addedBy: g.session.name,
    addedAt: new Date().toISOString(),
    active: b.active !== false,
    embedding: b.embedding,
  };
  store.data.watchlist.push(entry);

  // A newly added plate is immediately checked against recent history, so an
  // operator sees where the vehicle has already been rather than only where it
  // goes next.
  const historic = entry.active ? backfillCorrelation(entry) : 0;

  store.audit({
    actor: g.session.username,
    role: g.session.role,
    action: "watchlist.add",
    entity: "WatchlistEntry",
    entityId: entry.id,
    detail: `${entry.category} '${entry.value}' added (${entry.severity}); ${historic} historic match(es) raised`,
  });
  return json({ entry, historicMatches: historic }, { status: 201 });
}
