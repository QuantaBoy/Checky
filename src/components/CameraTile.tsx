"use client";

import { useEffect, useRef } from "react";
import type { Camera, Detection } from "@/lib/types";
import { Badge, StatusDot, ist, statusTone } from "./ui";

/**
 * A camera tile on the video wall.
 *
 * If the camera carries a real `streamUrl` (an HLS or MJPEG endpoint published by the
 * relay), that stream is played. Otherwise the tile renders a synthetic scene and says
 * so, in the corner, permanently: an evaluator must never be able to mistake a drawn
 * feed for a live one. The detection overlay is identical in both cases — it is driven
 * by the event bus, not by the pixels — which is the point the tile is making.
 */
export function CameraTile({
  camera,
  detections,
  onSelect,
  compact = false,
  alarm = false,
}: {
  camera: Camera;
  detections: Detection[];
  onSelect?: (c: Camera) => void;
  compact?: boolean;
  alarm?: boolean;
}) {
  const offline = camera.status === "offline" || camera.status === "unreachable";
  const latest = detections[0];

  return (
    <figure
      onClick={() => onSelect?.(camera)}
      className={`group relative overflow-hidden rounded-lg border bg-ink-900 ${
        alarm ? "border-alarm-500/70 shadow-[0_0_0_1px_rgba(239,68,68,0.35)]" : "border-ink-700"
      } ${onSelect ? "cursor-pointer hover:border-saffron-500/50" : ""}`}
    >
      <div className="relative aspect-video w-full">
        {offline ? (
          <OfflinePattern camera={camera} />
        ) : camera.streamUrl ? (
          <RealStream url={camera.streamUrl} name={camera.name} />
        ) : (
          <SyntheticScene camera={camera} />
        )}

        {/* Detection overlay — same code path for real and synthetic feeds. */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          {detections.slice(0, 4).map((d, i) => {
            const [x, y, w, h] = d.bbox ?? [0.3, 0.55, 0.16, 0.07];
            const stroke = d.type === "plate" ? "var(--color-saffron-400)" : "var(--color-signal-400)";
            return (
              <g key={d.id} opacity={1 - i * 0.22}>
                <rect
                  x={x * 100}
                  y={y * 100}
                  width={w * 100}
                  height={h * 100}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={0.6}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </svg>

        {/* Fixed-size labels live outside the SVG so they don't stretch with it. */}
        <div className="pointer-events-none absolute inset-0">
          {detections.slice(0, 4).map((d, i) => {
            const [x, y] = d.bbox ?? [0.3, 0.55];
            return (
              <span
                key={d.id}
                style={{ left: `${x * 100}%`, top: `${y * 100}%`, opacity: 1 - i * 0.22 }}
                className={`absolute -translate-y-full rounded-sm px-1 py-px font-mono text-[9px] leading-tight ${
                  d.type === "plate" ? "bg-saffron-500/85 text-ink-950" : "bg-signal-500/80 text-ink-950"
                }`}
              >
                {d.type === "plate" ? d.value : d.value.replace(/_/g, " ")} {Math.round(d.confidence * 100)}%
              </span>
            );
          })}
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-ink-950/85 to-transparent px-2 py-1.5">
          <div className="min-w-0">
            <div className="truncate text-[10.5px] font-medium text-mist-100">{camera.name}</div>
            {!compact && <div className="truncate text-[9px] text-mist-300">{camera.site}</div>}
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded bg-ink-950/70 px-1 py-0.5 text-[9px] uppercase tracking-wider text-mist-300">
            <StatusDot tone={statusTone(camera.status)} pulse={camera.status === "online"} />
            {camera.status}
          </span>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-ink-950/85 to-transparent px-2 py-1.5">
          <span className="font-mono text-[9px] text-mist-300">
            {camera.id} · {camera.anprEnabled ? "ANPR" : camera.type.toUpperCase()}
          </span>
          <span className="font-mono text-[9px] text-mist-300">
            {latest ? ist(latest.timestamp, { day: undefined, month: undefined }) : "—"}
          </span>
        </div>

        {!camera.streamUrl && !offline && (
          <span className="pointer-events-none absolute bottom-6 left-2 rounded border border-warn-500/50 bg-ink-950/80 px-1 py-px text-[8.5px] font-semibold uppercase tracking-wider text-warn-500">
            Simulated feed
          </span>
        )}
      </div>

      {!compact && (
        <figcaption className="flex items-center justify-between gap-2 border-t border-ink-700 px-2 py-1.5">
          <span className="truncate text-[10px] text-mist-400">
            {camera.vendor} · {camera.protocol.toUpperCase()}
          </span>
          {alarm ? <Badge tone="alarm">Watchlist hit</Badge> : <Badge tone="neutral">{camera.district}</Badge>}
        </figcaption>
      )}
    </figure>
  );
}

function RealStream({ url, name }: { url: string; name: string }) {
  const isImage = /\.(mjpe?g|jpe?g|png)(\?|$)/i.test(url) || url.includes("mjpg");
  if (isImage) {
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary external MJPEG endpoint
    return <img src={url} alt={`Live feed from ${name}`} className="h-full w-full object-cover" />;
  }
  return (
    <video
      src={url}
      className="h-full w-full object-cover"
      autoPlay
      muted
      playsInline
      loop
      aria-label={`Live feed from ${name}`}
    />
  );
}

function OfflinePattern({ camera }: { camera: Camera }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[repeating-linear-gradient(45deg,var(--color-ink-900)_0px,var(--color-ink-900)_10px,var(--color-ink-850)_10px,var(--color-ink-850)_20px)]">
      <span className="text-[11px] font-medium text-alarm-400">NO SIGNAL</span>
      <span className="max-w-[85%] text-center text-[9.5px] text-mist-400">
        Adapter cannot reach {camera.id} · last heartbeat {camera.lastHeartbeat ? ist(camera.lastHeartbeat) : "never"}
      </span>
    </div>
  );
}

/**
 * Synthetic scene: a stylised road view with moving vehicles, drawn per camera so
 * two tiles never look identical. Seeded from the camera id, so a given camera always
 * renders the same scene between reloads.
 */
function SyntheticScene({ camera }: { camera: Camera }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const seed = [...camera.id].reduce((s, ch) => s + ch.charCodeAt(0), 0);
    const rand = (n: number) => ((Math.sin(seed * 9301 + n * 49297) + 1) / 2) % 1;
    const night = camera.type === "thermal";
    const lanes = 3;
    const vehicles = Array.from({ length: 7 }, (_, i) => ({
      lane: i % lanes,
      x: rand(i) * 1.4 - 0.2,
      speed: 0.045 + rand(i + 20) * 0.09,
      w: 0.07 + rand(i + 40) * 0.06,
      hue: Math.floor(rand(i + 60) * 360),
      dir: rand(i + 80) > 0.5 ? 1 : -1,
    }));

    let raf = 0;
    let last = performance.now();
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { width: w, height: h } = canvas;

      // Sky / ambience
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      if (night) {
        sky.addColorStop(0, "#0b1a1c");
        sky.addColorStop(1, "#04292b");
      } else {
        sky.addColorStop(0, "#16202e");
        sky.addColorStop(1, "#0d141e");
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Horizon + roadway
      const horizon = h * 0.42;
      ctx.fillStyle = night ? "#07201f" : "#0a1119";
      ctx.fillRect(0, horizon, w, h - horizon);

      ctx.fillStyle = night ? "#123033" : "#151f2c";
      ctx.beginPath();
      ctx.moveTo(w * 0.18, h);
      ctx.lineTo(w * 0.42, horizon);
      ctx.lineTo(w * 0.62, horizon);
      ctx.lineTo(w * 1.02, h);
      ctx.closePath();
      ctx.fill();

      // Lane markings, perspective-scaled
      ctx.strokeStyle = "rgba(226,232,240,0.35)";
      ctx.lineWidth = 1;
      for (let l = 1; l < lanes; l += 1) {
        const t = l / lanes;
        ctx.beginPath();
        ctx.moveTo(w * (0.18 + 0.84 * t), h);
        ctx.lineTo(w * (0.42 + 0.2 * t), horizon);
        ctx.setLineDash([6, 10]);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Vehicles: nearer lanes are larger and faster across the frame.
      for (const v of vehicles) {
        if (!reduceMotion) v.x += v.speed * dt * v.dir;
        if (v.x > 1.25) v.x = -0.25;
        if (v.x < -0.25) v.x = 1.25;
        const depth = 0.35 + (v.lane / lanes) * 0.65;
        const y = horizon + (h - horizon) * depth;
        const vw = w * v.w * depth * 1.6;
        const vh = vw * 0.52;
        const x = w * v.x;
        ctx.fillStyle = night ? `hsla(${v.hue},20%,55%,0.75)` : `hsla(${v.hue},32%,52%,0.9)`;
        roundRect(ctx, x, y - vh, vw, vh, 3);
        ctx.fill();
        // Plate patch — the thing ANPR would actually read.
        ctx.fillStyle = "rgba(240,240,240,0.85)";
        ctx.fillRect(x + vw * (v.dir > 0 ? 0.72 : 0.08), y - vh * 0.34, vw * 0.2, vh * 0.16);
        // Headlights at dusk
        ctx.fillStyle = "rgba(255,224,160,0.35)";
        ctx.fillRect(x + (v.dir > 0 ? vw - 2 : 0), y - vh * 0.7, 2, 2);
      }

      // CCTV artefacts: scanlines + a little sensor noise.
      ctx.fillStyle = "rgba(0,0,0,0.14)";
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      for (let i = 0; i < 40; i += 1) {
        ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [camera.id, camera.type]);

  return <canvas ref={ref} width={320} height={180} className="h-full w-full object-cover" aria-label="Simulated camera feed" />;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
