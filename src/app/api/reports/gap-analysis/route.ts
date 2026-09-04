import { guard, isResponse } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import { haversineKm } from "@/lib/geo";
import { GUJARAT_DISTRICTS } from "@/lib/seed";
import { store } from "@/lib/store";
import { scoped } from "@/lib/api";

/** Gap-analysis export for planning use (Flow F step 4). */
export async function GET() {
  const g = await guard("report.export");
  if (isResponse(g)) return g;
  const cameras = scoped(store.data.cameras, g.scope);
  const now = Date.now();

  const rows = GUJARAT_DISTRICTS.map((d) => {
    const within = cameras.filter((c) => haversineKm(d, c) <= 35);
    const aging = within.filter((c) => now - new Date(c.installedAt).getTime() > 7 * 365 * 864e5);
    return {
      district: d.name,
      cameras_within_35km: within.length,
      anpr_cameras: within.filter((c) => c.anprEnabled).length,
      online: within.filter((c) => c.status === "online").length,
      offline_or_unreachable: within.filter((c) => c.status === "offline" || c.status === "unreachable").length,
      analog: within.filter((c) => c.analog).length,
      aging_over_7yr: aging.length,
      avg_retention_days: within.length
        ? Number((within.reduce((s, c) => s + c.retentionDays, 0) / within.length).toFixed(1))
        : 0,
      status: within.length === 0 ? "UNCOVERED" : within.filter((c) => c.anprEnabled).length === 0 ? "NO ANPR COVERAGE" : "COVERED",
      recommendation:
        within.length === 0
          ? "Priority 1 — no onboarded camera within 35 km of district HQ"
          : within.filter((c) => c.anprEnabled).length === 0
            ? "Priority 2 — cameras present but no ANPR capability for vehicle tracing"
            : aging.length
              ? `Priority 3 — ${aging.length} unit(s) beyond 7-year service life`
              : "No action",
    };
  });

  store.audit({
    actor: g.session.username,
    role: g.session.role,
    action: "report.gap_export",
    entity: "GapAnalysis",
    entityId: g.scope ?? "statewide",
    detail: `Gap-analysis report exported for ${rows.length} districts`,
  });

  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="sentinel-gap-analysis-${Date.now()}.csv"`,
    },
  });
}
