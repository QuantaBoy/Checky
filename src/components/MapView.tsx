"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, CircleMarker, LayerGroup, Polyline } from "leaflet";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  /** Free-form HTML-escaped detail lines for the popup. */
  detail?: string[];
  tone?: "ok" | "warn" | "alarm" | "info" | "accent" | "muted";
  radius?: number;
  /** Rendered as a numbered pin — used for ordered route hops. */
  index?: number;
}

export interface MapRoute {
  points: { lat: number; lng: number }[];
  /** Per-segment plausibility; a false entry is drawn dashed and red. */
  segmentPlausible?: boolean[];
}

const TONE_COLORS: Record<string, string> = {
  ok: "#22c55e",
  warn: "#f59e0b",
  alarm: "#ef4444",
  info: "#38bdf8",
  accent: "#f0a022",
  muted: "#7d90ab",
};

/**
 * Leaflet map wrapper. Uses circle markers rather than icon images so there are no
 * asset-path problems and no external image requests — the whole map is tiles plus
 * vectors.
 */
export function MapView({
  markers,
  route,
  height = 460,
  center = { lat: 22.6, lng: 71.8 },
  zoom = 7,
  fitToData = true,
  onSelect,
  className = "",
}: {
  markers: MapMarker[];
  route?: MapRoute;
  height?: number | string;
  center?: { lat: number; lng: number };
  zoom?: number;
  fitToData?: boolean;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const el = useRef<HTMLDivElement | null>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { zoomControl: true, attributionControl: true, preferCanvas: true }).setView(
        [center.lat, center.lng],
        zoom,
      );
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(m);
      layer.current = L.layerGroup().addTo(m);
      map.current = m;
      // The container is often sized by flexbox after mount; without this the tiles
      // render into a zero-height box and the map looks broken.
      setTimeout(() => m.invalidateSize(), 60);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map is created once by design
  }, []);

  // Redraw markers and route whenever the data changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !map.current || !layer.current) return;
      layer.current.clearLayers();

      const drawn: (CircleMarker | Polyline)[] = [];

      if (route && route.points.length > 1) {
        for (let i = 1; i < route.points.length; i += 1) {
          const ok = route.segmentPlausible?.[i - 1] ?? true;
          const line = L.polyline(
            [
              [route.points[i - 1].lat, route.points[i - 1].lng],
              [route.points[i].lat, route.points[i].lng],
            ],
            {
              color: ok ? "#f0a022" : "#ef4444",
              weight: ok ? 3 : 2.5,
              opacity: 0.9,
              dashArray: ok ? undefined : "6 6",
            },
          ).addTo(layer.current!);
          if (!ok) line.bindPopup("<b>Implausible leg</b><br>Speed required exceeds the plausibility threshold — treat as a possible cloned plate, OCR misread, or clock drift.");
          drawn.push(line);
        }
      }

      for (const mk of markers) {
        const color = TONE_COLORS[mk.tone ?? "muted"];
        const marker = L.circleMarker([mk.lat, mk.lng], {
          radius: mk.radius ?? (mk.index !== undefined ? 8 : 5),
          color,
          weight: mk.index !== undefined ? 2 : 1.5,
          fillColor: color,
          fillOpacity: mk.index !== undefined ? 0.85 : 0.55,
        }).addTo(layer.current!);

        const detail = (mk.detail ?? []).map((d) => `<div>${escapeHtml(d)}</div>`).join("");
        marker.bindPopup(
          `<b>${escapeHtml(mk.label)}</b>${mk.index !== undefined ? ` <span style="color:#f0a022">#${mk.index}</span>` : ""}${detail ? `<div style="margin-top:4px;color:#9fb0c8">${detail}</div>` : ""}`,
        );
        marker.on("click", () => select.current?.(mk.id));
        if (mk.index !== undefined) {
          marker
            .bindTooltip(String(mk.index), {
              permanent: true,
              direction: "center",
              className: "sentinel-hop-label",
            })
            .openTooltip();
        }
        drawn.push(marker);
      }

      if (fitToData && (markers.length || route?.points.length)) {
        const pts: [number, number][] = [
          ...markers.map((m) => [m.lat, m.lng] as [number, number]),
          ...(route?.points.map((p) => [p.lat, p.lng] as [number, number]) ?? []),
        ];
        if (pts.length === 1) map.current.setView(pts[0], 13);
        else if (pts.length > 1) map.current.fitBounds(L.latLngBounds(pts).pad(0.15));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [markers, route, fitToData]);

  return (
    <>
      <div
        ref={el}
        className={`w-full overflow-hidden rounded-lg border border-ink-700 ${className}`}
        style={{ height }}
        role="application"
        aria-label="Camera coverage map"
      />
      <style jsx global>{`
        .sentinel-hop-label {
          background: transparent;
          border: none;
          box-shadow: none;
          color: #070a10;
          font-size: 9px;
          font-weight: 700;
          padding: 0;
        }
        .sentinel-hop-label::before {
          display: none;
        }
      `}</style>
    </>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
