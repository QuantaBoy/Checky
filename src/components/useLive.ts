"use client";

import { useEffect, useRef, useState } from "react";
import type { Alert, BusEvents, BusTopic, Detection } from "@/lib/types";

/**
 * Subscribe to the platform's live event stream.
 *
 * The server already applies department scoping before writing to the stream, so
 * everything received here is something this session is allowed to see.
 */
export function useLive<T extends BusTopic>(
  topics: T[],
  onEvent: (topic: T, payload: BusEvents[T]) => void,
): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const key = topics.join(",");

  useEffect(() => {
    const es = new EventSource("/api/events");
    const listeners: [string, EventListener][] = [];

    es.addEventListener("ready", () => setConnected(true));
    for (const topic of key.split(",") as T[]) {
      const fn: EventListener = (e) => {
        try {
          handler.current(topic, JSON.parse((e as MessageEvent).data));
        } catch {
          /* malformed frame — skip rather than kill the stream */
        }
      };
      es.addEventListener(topic, fn);
      listeners.push([topic, fn]);
    }
    es.onerror = () => setConnected(false);
    // EventSource reconnects on its own; onopen fires again and `ready` follows.
    es.onopen = () => setConnected(true);

    return () => {
      for (const [t, fn] of listeners) es.removeEventListener(t, fn);
      es.close();
      setConnected(false);
    };
  }, [key]);

  return { connected };
}

/** Rolling buffer of the newest detections, oldest evicted. */
export function useDetectionFeed(limit = 60): { detections: Detection[]; connected: boolean } {
  const [detections, setDetections] = useState<Detection[]>([]);
  const { connected } = useLive(["detection.anpr", "detection.object", "detection.person"], (_t, payload) => {
    const d = payload as Detection;
    setDetections((prev) => [d, ...prev].slice(0, limit));
  });
  return { detections, connected };
}

/**
 * Alert rows carry camera/watchlist context when they come from the REST endpoint.
 * Alerts arriving live off the bus have only the ids, so these stay optional and
 * the UI falls back to the id it already has.
 */
export interface EnrichedAlert extends Alert {
  cameraName?: string;
  site?: string;
  district?: string;
  watchlistValue?: string;
  watchlistCategory?: string;
  watchlistDescription?: string;
  caseRef?: string;
}

/** Live alert queue, seeded from the API then kept current by the stream. */
export function useAlertFeed(limit = 50): {
  alerts: EnrichedAlert[];
  connected: boolean;
  refresh: () => void;
  setAlerts: React.Dispatch<React.SetStateAction<EnrichedAlert[]>>;
} {
  const [alerts, setAlerts] = useState<EnrichedAlert[]>([]);

  const refresh = () => {
    fetch("/api/alerts?limit=" + limit)
      .then((r) => (r.ok ? r.json() : { alerts: [] }))
      .then((d) => setAlerts(d.alerts ?? []))
      .catch(() => undefined);
  };

  useEffect(refresh, [limit]);

  const { connected } = useLive(["alert.raised", "alert.updated"], (topic, payload) => {
    const a = payload as EnrichedAlert;
    setAlerts((prev) =>
      topic === "alert.raised"
        ? [a, ...prev.filter((x) => x.id !== a.id)].slice(0, limit)
        : prev.map((x) => (x.id === a.id ? { ...x, ...a } : x)),
    );
  });

  return { alerts, connected, refresh, setAlerts };
}
