import { NextRequest } from "next/server";
import { guard, isResponse, json } from "@/lib/api";
import { normalizePlate, store } from "@/lib/store";

export async function GET(req: NextRequest) {
  const g = await guard("camera.read");
  if (isResponse(g)) return g;
  const q = req.nextUrl.searchParams;
  const cameraId = q.get("camera");
  const type = q.get("type");
  const plate = q.get("plate");
  const since = q.get("since");
  const limit = Math.min(Number(q.get("limit") ?? 200) || 200, 2000);
  const sinceMs = since ? new Date(since).getTime() : null;

  const visible = g.scope
    ? new Set(store.data.cameras.filter((c) => c.deptId === g.scope).map((c) => c.id))
    : null;

  const rows = store.data.detections
    .filter((d) => {
      if (visible && !visible.has(d.cameraId)) return false;
      if (cameraId && d.cameraId !== cameraId) return false;
      if (type && d.type !== type) return false;
      if (plate && normalizePlate(d.value) !== normalizePlate(plate)) return false;
      if (sinceMs !== null && new Date(d.timestamp).getTime() < sinceMs) return false;
      return true;
    })
    .slice(-limit)
    .reverse();

  return json({ detections: rows, total: rows.length, scope: g.scope });
}
