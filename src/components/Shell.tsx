"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ROLE_LABELS, type Capability } from "@/lib/rbac";
import type { Session } from "@/lib/types";
import { Badge, StatusDot } from "./ui";
import { useLive } from "./useLive";

interface NavItem {
  href: string;
  label: string;
  cap: Capability;
  group: "Operations" | "Registry" | "Governance";
  hint: string;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Unified Dashboard", cap: "alert.read", group: "Operations", hint: "Video wall + live alert queue" },
  { href: "/alerts", label: "Alert Queue", cap: "alert.read", group: "Operations", hint: "Watchlist matches and actions" },
  { href: "/trace", label: "Vehicle & Person Trace", cap: "trace.read", group: "Operations", hint: "Cross-camera route reconstruction" },
  { href: "/map", label: "GIS Map", cap: "camera.read", group: "Registry", hint: "Layered camera coverage map" },
  { href: "/registry", label: "Camera Registry", cap: "camera.read", group: "Registry", hint: "Asset inventory and onboarding" },
  { href: "/adapters", label: "Federation Adapters", cap: "adapter.read", group: "Registry", hint: "Connector health and credentials" },
  { href: "/watchlist", label: "Watchlist", cap: "watchlist.read", group: "Governance", hint: "Vehicles and persons of interest" },
  { href: "/gap-analysis", label: "Gap Analysis", cap: "gap.read", group: "Governance", hint: "Coverage and infrastructure gaps" },
  { href: "/reports", label: "Reports", cap: "report.export", group: "Governance", hint: "Detection and route exports" },
  { href: "/audit", label: "Audit Trail", cap: "audit.read", group: "Governance", hint: "Hash-chained action log" },
];

const REFERENCE = [
  { href: "/architecture", label: "Architecture" },
  { href: "/api-docs", label: "API Docs" },
  { href: "/resources", label: "Evaluation" },
];

export function Shell({
  session,
  capabilities,
  children,
}: {
  session: Session;
  capabilities: Capability[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newAlerts, setNewAlerts] = useState(0);

  const { connected } = useLive(["alert.raised"], () => setNewAlerts((n) => n + 1));

  // Clear the badge when the operator actually looks at the alerts.
  useEffect(() => {
    if (pathname === "/alerts" || pathname === "/dashboard") setNewAlerts(0);
  }, [pathname]);

  const allowed = NAV.filter((n) => capabilities.includes(n.cap));
  const groups = ["Operations", "Registry", "Governance"] as const;

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-ink-700 bg-ink-900/95 px-3 py-2 backdrop-blur">
        <button
          className="rounded border border-ink-600 px-2 py-1 text-mist-300 lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          ☰
        </button>

        <Link href="/dashboard" className="flex items-center gap-2.5">
          <ShieldMark />
          <span className="leading-tight">
            <span className="block text-[13px] font-semibold tracking-wide text-mist-100">SENTINEL</span>
            <span className="block text-[9.5px] uppercase tracking-[0.18em] text-mist-400">
              Integrated VM &amp; Analytics
            </span>
          </span>
        </Link>

        <div className="ml-2 hidden items-center gap-2 md:flex">
          <Badge tone="signal" title="Hybrid of Reference Model 1 and Reference Model 3">
            Model 1 + 3 Hybrid
          </Badge>
          <Badge tone={connected ? "ok" : "alarm"} title={connected ? "Event stream connected" : "Event stream disconnected"}>
            <StatusDot tone={connected ? "ok" : "alarm"} pulse={connected} />
            {connected ? "Bus live" : "Bus down"}
          </Badge>
          {newAlerts > 0 && (
            <Link href="/alerts">
              <Badge tone="alarm" className="animate-pulse-slow">
                {newAlerts} new alert{newAlerts === 1 ? "" : "s"}
              </Badge>
            </Link>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-[11.5px] font-medium text-mist-100">{session.name}</div>
            <div className="text-[10px] text-mist-400">
              {ROLE_LABELS[session.role]}
              {session.deptId ? ` · scoped to ${session.deptId}` : ""}
            </div>
          </div>
          <button
            onClick={logout}
            className="rounded border border-ink-600 px-2.5 py-1 text-[11px] text-mist-300 transition-colors hover:bg-ink-700 hover:text-mist-100"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <nav
          className={`${open ? "block" : "hidden"} w-full shrink-0 border-b border-ink-700 bg-ink-900/70 p-3 lg:block lg:w-56 lg:border-r lg:border-b-0`}
        >
          {groups.map((grp) => {
            const items = allowed.filter((n) => n.group === grp);
            if (!items.length) return null;
            return (
              <div key={grp} className="mb-4">
                <div className="mb-1.5 px-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-mist-400/70">
                  {grp}
                </div>
                <ul className="space-y-0.5">
                  {items.map((n) => {
                    const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
                    return (
                      <li key={n.href}>
                        <Link
                          href={n.href}
                          title={n.hint}
                          onClick={() => setOpen(false)}
                          className={`block rounded px-2 py-1.5 text-[12px] transition-colors ${
                            active
                              ? "bg-saffron-500/12 text-saffron-300 shadow-[inset_2px_0_0_var(--color-saffron-500)]"
                              : "text-mist-300 hover:bg-ink-700/60 hover:text-mist-100"
                          }`}
                        >
                          {n.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          <div className="mb-2 border-t border-ink-700 pt-3">
            <div className="mb-1.5 px-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-mist-400/70">
              Reference
            </div>
            <ul className="space-y-0.5">
              {REFERENCE.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded px-2 py-1.5 text-[12px] transition-colors ${
                      pathname === r.href ? "bg-ink-700 text-mist-100" : "text-mist-400 hover:bg-ink-700/60 hover:text-mist-200"
                    }`}
                  >
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <p className="px-2 text-[9.5px] leading-relaxed text-mist-400/70">
            Demo environment. Synthetic cameras, synthetic watchlist, simulated detections — no production data.
          </p>
        </nav>

        <main className="min-w-0 flex-1 p-3 lg:p-4">{children}</main>
      </div>
    </div>
  );
}

function ShieldMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5 20 5.5v6.2c0 4.6-3.2 8.6-8 9.8-4.8-1.2-8-5.2-8-9.8V5.5L12 2.5Z"
        stroke="var(--color-saffron-500)"
        strokeWidth="1.3"
        fill="rgba(240,160,34,0.10)"
      />
      <circle cx="12" cy="11" r="3.1" stroke="var(--color-signal-500)" strokeWidth="1.3" />
      <circle cx="12" cy="11" r="1" fill="var(--color-signal-400)" />
      <path d="M12 14.1v3.4" stroke="var(--color-signal-500)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
