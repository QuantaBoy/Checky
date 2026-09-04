import { NextRequest } from "next/server";
import { fail, guard, isResponse, json } from "@/lib/api";
import { engine } from "@/lib/engine";
import { normalizePlate, store } from "@/lib/store";

/**
 * Evaluation scenario control (Flow G).
 *
 * Judges nominate a registration number; the platform records it as the designated
 * vehicle and immediately puts it on a live corridor so the trace can be watched
 * building in real time rather than only replayed from history.
 */
export async function GET() {
  const g = await guard("trace.read");
  if (isResponse(g)) return g;
  return json({
    designatedVehicle: store.data.designatedVehicle,
    corridors: Object.entries(store.data.corridors).map(([id, cams]) => ({
      id,
      cameras: cams.length,
      path: cams.map((c) => store.camera(c)?.site ?? c),
    })),
    watchlistVehicles: store.data.watchlist.filter((w) => w.kind === "vehicle" && w.active).map((w) => w.value),
  });
}

export async function POST(req: NextRequest) {
  const g = await guard("trace.read");
  if (isResponse(g)) return g;
  const body = (await req.json().catch(() => null)) as { plate?: string; live?: boolean } | null;
  const plate = normalizePlate(body?.plate ?? "");
  if (!plate) return fail(400, "plate is required");
  if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/.test(plate)) {
    return fail(400, `'${body?.plate}' is not a recognisable Indian registration number`);
  }

  store.data.designatedVehicle = plate;
  const launched = body?.live === false ? false : engine().source.launchJourney(plate, { startAt: Date.now() });

  store.audit({
    actor: g.session.username,
    role: g.session.role,
    action: "scenario.designate_vehicle",
    entity: "Vehicle",
    entityId: plate,
    detail: `Designated for the evaluation trace scenario${launched ? "; live corridor journey launched" : ""}`,
  });

  return json({ designatedVehicle: plate, liveJourneyLaunched: launched });
}
