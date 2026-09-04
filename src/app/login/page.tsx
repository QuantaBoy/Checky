"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, inputClass } from "@/components/ui";

const DEMO_ACCOUNTS = [
  { username: "operator", role: "Control Room Operator", lands: "Unified Dashboard", note: "Video wall, live alert queue, acknowledge/dispatch" },
  { username: "investigator", role: "Investigating Officer", lands: "Vehicle & Person Trace", note: "Route reconstruction and evidence export" },
  { username: "watchlist", role: "Watchlist Administrator", lands: "Watchlist", note: "Manage vehicles/persons of interest, match history" },
  { username: "deptadmin", role: "Department Admin (D02 Urban Dev)", lands: "Camera Registry", note: "Scoped to own department's cameras and adapters only" },
  { username: "admin", role: "Platform Admin", lands: "Federation Adapters", note: "Full cross-department access, audit, user management" },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("operator");
  const [password, setPassword] = useState("sentinel");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sign-in failed");
        return;
      }
      router.push(data.home ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the platform. Is the server running?");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-ink-700 p-10 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-ink-600) 1px, transparent 1px), linear-gradient(90deg, var(--color-ink-600) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative">
          <div className="mb-8 flex items-center gap-3">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 2.5 20 5.5v6.2c0 4.6-3.2 8.6-8 9.8-4.8-1.2-8-5.2-8-9.8V5.5L12 2.5Z"
                stroke="var(--color-saffron-500)"
                strokeWidth="1.3"
                fill="rgba(240,160,34,0.10)"
              />
              <circle cx="12" cy="11" r="3.1" stroke="var(--color-signal-500)" strokeWidth="1.3" />
              <circle cx="12" cy="11" r="1" fill="var(--color-signal-400)" />
            </svg>
            <div>
              <div className="text-lg font-semibold tracking-wide">SENTINEL</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-mist-400">
                Integrated Video Management &amp; Analytics Platform
              </div>
            </div>
          </div>

          <h1 className="max-w-lg text-3xl leading-tight font-light text-mist-100">
            One operational picture across{" "}
            <span className="font-medium text-saffron-400">26 departments</span> — without replacing a
            single existing VMS.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-mist-300">
            A centralised CCTV registry with GIS mapping (Reference Model 1) layered under a VMS
            federation middleware (Reference Model 3). Departments keep their own cameras, storage and
            retention policy; Sentinel adds the registry, the adapters, the analytics and the alerting
            on top.
          </p>

          <dl className="mt-10 grid max-w-lg grid-cols-2 gap-3">
            {[
              ["Registry & GIS", "Every camera, its owner, protocol, retention and health on one map"],
              ["Federation adapters", "RTSP / ONVIF / vendor SDK behind one interface — no lock-in"],
              ["ANPR + watchlist", "Continuous cross-referencing with real-time alerting"],
              ["Cross-camera trace", "Timestamped, location-wise movement reconstruction"],
            ].map(([t, d]) => (
              <div key={t} className="rounded border border-ink-700 bg-ink-850/50 p-3">
                <dt className="text-[11px] font-medium text-saffron-300">{t}</dt>
                <dd className="mt-1 text-[11px] leading-relaxed text-mist-400">{d}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative text-[10px] text-mist-400/80">
          Gujarat Police Innovation Challenge 2026 · Demo environment with synthetic data only
        </p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-base font-semibold text-mist-100">Sign in</h2>
          <p className="mt-1 text-xs text-mist-400">
            Access is role-based. Your role decides which screens and which department's data you see.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <Field label="Username">
              <input
                className={inputClass}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </Field>
            <Field label="Password">
              <input
                className={inputClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            {error && (
              <p role="alert" className="rounded border border-alarm-500/50 bg-alarm-500/10 px-2.5 py-1.5 text-[11px] text-alarm-400">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-8">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-mist-400">
              Demo accounts · password <code className="text-saffron-300">sentinel</code>
            </div>
            <ul className="space-y-1">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.username}>
                  <button
                    type="button"
                    onClick={() => {
                      setUsername(a.username);
                      setPassword("sentinel");
                    }}
                    className="w-full rounded border border-ink-700 bg-ink-850/50 px-2.5 py-2 text-left transition-colors hover:border-saffron-500/40 hover:bg-ink-800"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[11px] text-saffron-300">{a.username}</span>
                      <span className="text-[10px] text-mist-400">→ {a.lands}</span>
                    </div>
                    <div className="text-[11px] text-mist-200">{a.role}</div>
                    <div className="text-[10px] text-mist-400">{a.note}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
