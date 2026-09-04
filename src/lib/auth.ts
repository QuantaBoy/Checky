/**
 * Session handling.
 *
 * Demo-grade by design: an HMAC-signed cookie over a small session payload, no
 * external identity provider. It is signed (not just base64) so a session cannot be
 * forged client-side to escalate role or department — the RBAC checks downstream are
 * only worth anything if the session they read is trustworthy.
 *
 * Production replaces this with the state SSO / eGujCop identity federation; the
 * `getSession()` contract stays the same.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { store } from "./store";
import type { Session, User } from "./types";

const COOKIE = "sentinel_session";
const MAX_AGE_S = 8 * 3600;
const SECRET =
  process.env.SENTINEL_SESSION_SECRET ??
  // Dev fallback. Set SENTINEL_SESSION_SECRET in any real deployment.
  "sentinel-demo-secret-do-not-use-in-production";

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function encodeSession(s: Session): string {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (Date.now() - s.issuedAt > MAX_AGE_S * 1000) return null;
    return s;
  } catch {
    return null;
  }
}

export function sessionFor(user: User): Session {
  return {
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    deptId: user.deptId,
    designation: user.designation,
    issuedAt: Date.now(),
  };
}

export function authenticate(username: string, password: string): User | null {
  const u = store.data.users.find((x) => x.username === username.trim().toLowerCase());
  if (!u || u.password !== password) return null;
  return u;
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return decodeSession(jar.get(COOKIE)?.value);
}

export const SESSION_COOKIE = COOKIE;
export const SESSION_MAX_AGE = MAX_AGE_S;
