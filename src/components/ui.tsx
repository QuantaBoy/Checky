"use client";

import React from "react";

/** Shared presentational primitives. Deliberately small — no component library. */

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-ink-700 bg-ink-850/70 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700 px-4 py-2.5">
          <div className="min-w-0">
            {title && <h2 className="truncate text-[13px] font-semibold tracking-wide text-mist-100">{title}</h2>}
            {subtitle && <p className="mt-0.5 truncate text-[11px] text-mist-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

const TONES = {
  neutral: "border-ink-600 bg-ink-700/60 text-mist-200",
  ok: "border-ok-500/40 bg-ok-500/10 text-ok-500",
  warn: "border-warn-500/40 bg-warn-500/10 text-warn-500",
  alarm: "border-alarm-500/50 bg-alarm-500/15 text-alarm-400",
  info: "border-info-500/40 bg-info-500/10 text-info-500",
  accent: "border-saffron-500/40 bg-saffron-500/10 text-saffron-400",
  signal: "border-signal-500/40 bg-signal-500/10 text-signal-400",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({
  children,
  tone = "neutral",
  className = "",
  title,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone = "neutral", pulse = false }: { tone?: Tone; pulse?: boolean }) {
  const color =
    tone === "ok" ? "bg-ok-500" : tone === "warn" ? "bg-warn-500" : tone === "alarm" ? "bg-alarm-500" : tone === "info" ? "bg-info-500" : tone === "signal" ? "bg-signal-500" : "bg-mist-400";
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${color} ${pulse ? "animate-pulse-slow" : ""}`} />;
}

export function Button({
  children,
  variant = "default",
  size = "md",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45";
  const sizes = size === "sm" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs";
  const variants = {
    default: "border-ink-600 bg-ink-700/70 text-mist-200 hover:bg-ink-600 hover:text-mist-100",
    primary: "border-saffron-500/60 bg-saffron-500/15 text-saffron-300 hover:bg-saffron-500/25",
    ghost: "border-transparent bg-transparent text-mist-300 hover:bg-ink-700/70 hover:text-mist-100",
    danger: "border-alarm-500/50 bg-alarm-500/15 text-alarm-400 hover:bg-alarm-500/25",
  }[variant];
  return (
    <button className={`${base} ${sizes} ${variants} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-mist-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-mist-400">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded border border-ink-600 bg-ink-900/80 px-2.5 py-1.5 text-xs text-mist-100 placeholder:text-mist-400/60 focus:border-saffron-500/60 focus:outline-none";

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
}) {
  const accent =
    tone === "alarm" ? "text-alarm-400" : tone === "ok" ? "text-ok-500" : tone === "warn" ? "text-warn-500" : tone === "accent" ? "text-saffron-400" : tone === "signal" ? "text-signal-400" : "text-mist-100";
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-850/60 px-3 py-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-mist-400">{label}</div>
      <div className={`mt-1 font-mono text-xl leading-none ${accent}`}>{value}</div>
      {sub && <div className="mt-1 text-[10px] text-mist-400">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-24 items-center justify-center rounded border border-dashed border-ink-600 px-4 py-8 text-center text-xs text-mist-400">
      {children}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-6 text-xs text-mist-400">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-ink-600 border-t-saffron-400" />
      {label}…
    </div>
  );
}

export function Table({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full min-w-max border-collapse text-left text-xs ${className}`}>{children}</table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`sticky top-0 z-10 border-b border-ink-700 bg-ink-850 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-mist-400 ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, className = "", title }: { children?: React.ReactNode; className?: string; title?: string }) {
  return <td className={`border-b border-ink-800 px-2.5 py-1.5 align-top text-mist-200 ${className}`} title={title}>{children}</td>;
}

export function severityTone(sev: string): Tone {
  return sev === "critical" ? "alarm" : sev === "high" ? "warn" : sev === "medium" ? "info" : "neutral";
}

export function statusTone(status: string): Tone {
  if (status === "online" || status === "healthy") return "ok";
  if (status === "degraded") return "warn";
  if (status === "offline" || status === "unreachable" || status === "down") return "alarm";
  return "neutral";
}

/** IST is the operational timezone for every user of this platform. */
export function ist(ts: string | number | Date | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...opts,
  });
}

export function timeAgo(ts: string | number | null | undefined): string {
  if (!ts) return "never";
  const s = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 0) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
