import { guard, isResponse, json, scoped } from "@/lib/api";
import { haversineKm } from "@/lib/geo";
import { GUJARAT_DISTRICTS } from "@/lib/seed";
import { store } from "@/lib/store";

/** A district with no camera within this radius of its headquarters counts as uncovered. */
const COVERAGE_RADIUS_KM = 35;
/** Cameras older than this are treated as approaching end of life. */
const AGING_YEARS = 7;
/** A camera whose last heartbeat is older than this is stale regardless of its status field. */
const STALE_HEARTBEAT_MIN = 15;

/** Gap analysis & registry reporting (FR4 / Flow F). */
export async function GET() {
  const g = await guard("gap.read");
  if (isResponse(g)) return g;
  const cameras = scoped(store.data.cameras, g.scope);
  const now = Date.now();

  const districtCoverage = GUJARAT_DISTRICTS.map((d) => {
    const within = cameras.filter((c) => haversineKm(d, c) <= COVERAGE_RADIUS_KM);
    return {
      district: d.name,
      lat: d.lat,
      lng: d.lng,
      cameras: within.length,
      anpr: within.filter((c) => c.anprEnabled).length,
      online: within.filter((c) => c.status === "online").length,
      covered: within.length > 0,
    };
  });

  const uncovered = districtCoverage.filter((d) => !d.covered);
  const anprBlind = districtCoverage.filter((d) => d.covered && d.anpr === 0);

  const offline = cameras.filter((c) => c.status === "offline" || c.status === "unreachable");
  const degraded = cameras.filter((c) => c.status === "degraded");
  const stale = cameras.filter(
    (c) => c.lastHeartbeat && now - new Date(c.lastHeartbeat).getTime() > STALE_HEARTBEAT_MIN * 60_000,
  );
  const aging = cameras.filter((c) => now - new Date(c.installedAt).getTime() > AGING_YEARS * 365 * 864e5);
  const analog = cameras.filter((c) => c.analog);
  // Retention below 15 days is the practical floor for an investigation that starts
  // a fortnight after the incident, which is common.
  const shortRetention = cameras.filter((c) => c.retentionDays < 15);

  const byDept = store.data.departments
    .filter((d) => !g.scope || d.id === g.scope)
    .map((d) => {
      const cams = cameras.filter((c) => c.deptId === d.id);
      return {
        deptId: d.id,
        dept: d.shortName,
        vendor: d.vmsVendor,
        total: cams.length,
        online: cams.filter((c) => c.status === "online").length,
        offline: cams.filter((c) => c.status === "offline" || c.status === "unreachable").length,
        anpr: cams.filter((c) => c.anprEnabled).length,
        avgRetention: cams.length
          ? Number((cams.reduce((s, c) => s + c.retentionDays, 0) / cams.length).toFixed(1))
          : 0,
        availability: cams.length
          ? Number(((cams.filter((c) => c.status === "online").length / cams.length) * 100).toFixed(1))
          : 0,
      };
    })
    .filter((d) => d.total > 0);

  return json({
    generatedAt: new Date().toISOString(),
    scope: g.scope,
    parameters: { coverageRadiusKm: COVERAGE_RADIUS_KM, agingYears: AGING_YEARS, staleHeartbeatMinutes: STALE_HEARTBEAT_MIN },
    totals: {
      cameras: cameras.length,
      online: cameras.filter((c) => c.status === "online").length,
      availability: cameras.length
        ? Number(((cameras.filter((c) => c.status === "online").length / cameras.length) * 100).toFixed(1))
        : 0,
      districtsCovered: districtCoverage.filter((d) => d.covered).length,
      districtsTotal: GUJARAT_DISTRICTS.length,
    },
    findings: {
      uncoveredDistricts: uncovered,
      anprBlindDistricts: anprBlind,
      offline: offline.map(slim),
      degraded: degraded.map(slim),
      staleHeartbeat: stale.map(slim),
      agingInfrastructure: aging.map((c) => ({
        ...slim(c),
        ageYears: Number(((now - new Date(c.installedAt).getTime()) / (365 * 864e5)).toFixed(1)),
      })),
      analogCameras: analog.map(slim),
      shortRetention: shortRetention.map((c) => ({ ...slim(c), retentionDays: c.retentionDays })),
    },
    byDepartment: byDept,
    districtCoverage,
  });
}

function slim(c: { id: string; name: string; site: string; district: string; deptId: string; status: string; vendor: string }) {
  return {
    id: c.id,
    name: c.name,
    site: c.site,
    district: c.district,
    deptId: c.deptId,
    status: c.status,
    vendor: c.vendor,
  };
}
