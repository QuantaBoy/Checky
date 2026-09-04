import { getSession } from "@/lib/auth";
import { bus } from "@/lib/bus";
import { ensureBooted } from "@/lib/engine";
import { scopeDeptId } from "@/lib/rbac";
import { store } from "@/lib/store";
import type { BusEvents, BusTopic } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Live event stream to the browser (Server-Sent Events).
 *
 * Department scoping is applied HERE, on the server, before an event is written to
 * the stream. Broadcasting everything and filtering in React would leak every
 * department's detections to any client willing to read the raw stream — the filter
 * has to sit where the data is, not where it is displayed.
 */
export async function GET(req: Request) {
  ensureBooted();
  const session = await getSession();
  if (!session) return new Response("Not authenticated", { status: 401 });
  const scope = scopeDeptId(session);

  const deptOf = (cameraId: string) => store.camera(cameraId)?.deptId ?? null;

  const visible = <T extends BusTopic>(topic: T, payload: BusEvents[T]): boolean => {
    if (!scope) return true;
    switch (topic) {
      case "detection.anpr":
      case "detection.object":
      case "detection.person":
        return deptOf((payload as BusEvents["detection.anpr"]).cameraId) === scope;
      case "watchlist.match":
        return deptOf((payload as BusEvents["watchlist.match"]).detection.cameraId) === scope;
      case "alert.raised":
      case "alert.updated":
        return (payload as BusEvents["alert.raised"]).deptId === scope;
      case "camera.health":
        return (payload as BusEvents["camera.health"]).deptId === scope;
      case "adapter.health":
        return (payload as BusEvents["adapter.health"]).deptId === scope;
      default:
        return false;
    }
  };

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepalive: NodeJS.Timeout | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };

      send("ready", { scope, role: session.role, at: new Date().toISOString() });

      unsubscribe = bus.subscribeAll((topic, payload) => {
        if (!visible(topic, payload)) return;
        send(topic, payload);
      });

      // Proxies drop idle connections; a comment frame every 20s keeps the stream up
      // without emitting a fake event the client would have to filter out.
      keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
        } catch {
          cleanup();
        }
      }, 20_000);
      keepalive.unref?.();

      const cleanup = () => {
        unsubscribe?.();
        unsubscribe = null;
        if (keepalive) clearInterval(keepalive);
        keepalive = null;
      };

      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      unsubscribe?.();
      if (keepalive) clearInterval(keepalive);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
