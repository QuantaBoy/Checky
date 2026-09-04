/** Shared helpers for route handlers: boot, auth gate, RBAC gate, JSON shapes. */

import { NextResponse } from "next/server";
import { getSession } from "./auth";
import { ensureBooted } from "./engine";
import { can, scopeDeptId, type Capability } from "./rbac";
import type { Session } from "./types";

export interface Guarded {
  session: Session;
  /** null for cross-department roles; a department id for scoped roles. */
  scope: string | null;
}

export function json(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as object, init);
}

export function fail(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Boot the platform, verify the session, and check one capability.
 *
 * Returns either the guarded context or the response to send. Route handlers must
 * bail on the response — this is the single place authorization is decided, so a new
 * endpoint cannot accidentally ship without a check.
 */
export async function guard(cap: Capability): Promise<Guarded | NextResponse> {
  ensureBooted();
  const session = await getSession();
  if (!session) return fail(401, "Not authenticated");
  if (!can(session, cap)) return fail(403, `Role '${session.role}' lacks capability '${cap}'`);
  return { session, scope: scopeDeptId(session) };
}

export function isResponse(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}

/** Apply department scoping to any row that carries a deptId. */
export function scoped<T extends { deptId: string }>(rows: T[], scope: string | null): T[] {
  return scope ? rows.filter((r) => r.deptId === scope) : rows;
}
