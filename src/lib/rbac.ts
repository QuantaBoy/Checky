/**
 * Role-based access control (FR18).
 *
 * Two things matter here and both are enforced server-side, never in the browser:
 *  1. Which capabilities a role holds.
 *  2. Which department's rows a session may see — `scopeDeptId` is applied to every
 *     query and to the live event stream, so a department admin cannot receive another
 *     department's detections even by holding an SSE connection open.
 */

import type { Role, Session } from "./types";

export type Capability =
  | "camera.read"
  | "camera.write"
  | "camera.delete"
  | "adapter.read"
  | "adapter.write"
  | "watchlist.read"
  | "watchlist.write"
  | "alert.read"
  | "alert.action"
  | "trace.read"
  | "audit.read"
  | "report.export"
  | "gap.read"
  | "user.manage";

const MATRIX: Record<Role, Capability[]> = {
  operator: ["camera.read", "adapter.read", "watchlist.read", "alert.read", "alert.action", "trace.read", "report.export", "gap.read"],
  investigator: ["camera.read", "watchlist.read", "alert.read", "trace.read", "report.export", "audit.read"],
  watchlist_admin: ["camera.read", "watchlist.read", "watchlist.write", "alert.read", "trace.read", "report.export", "audit.read"],
  dept_admin: ["camera.read", "camera.write", "camera.delete", "adapter.read", "adapter.write", "alert.read", "report.export", "gap.read", "trace.read"],
  platform_admin: [
    "camera.read", "camera.write", "camera.delete", "adapter.read", "adapter.write",
    "watchlist.read", "watchlist.write", "alert.read", "alert.action", "trace.read",
    "audit.read", "report.export", "gap.read", "user.manage",
  ],
};

export const ROLE_LABELS: Record<Role, string> = {
  operator: "Control Room Operator",
  investigator: "Investigating Officer",
  watchlist_admin: "Watchlist Administrator",
  dept_admin: "Department Admin",
  platform_admin: "Platform Admin",
};

export const ROLE_HOME: Record<Role, string> = {
  operator: "/dashboard",
  investigator: "/trace",
  watchlist_admin: "/watchlist",
  dept_admin: "/registry",
  platform_admin: "/adapters",
};

export function can(session: Session | null, cap: Capability): boolean {
  if (!session) return false;
  return MATRIX[session.role].includes(cap);
}

export function capabilities(role: Role): Capability[] {
  return MATRIX[role];
}

/**
 * The department filter a session is confined to, or null for cross-department roles.
 * Every API handler that returns camera-linked rows passes this into its query.
 */
export function scopeDeptId(session: Session | null): string | null {
  if (!session) return null;
  return session.role === "dept_admin" ? session.deptId : null;
}
