import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, authenticate, encodeSession, sessionFor } from "@/lib/auth";
import { ensureBooted } from "@/lib/engine";
import { store } from "@/lib/store";
import { ROLE_HOME } from "@/lib/rbac";

export async function POST(req: NextRequest) {
  ensureBooted();
  const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const username = (body.username ?? "").trim();
  const password = body.password ?? "";
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }
  const user = authenticate(username, password);
  if (!user) {
    store.audit({
      actor: username,
      role: "system",
      action: "auth.login.failed",
      entity: "User",
      entityId: username,
      detail: "Invalid credentials",
    });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const session = sessionFor(user);
  store.audit({
    actor: user.username,
    role: user.role,
    action: "auth.login",
    entity: "User",
    entityId: user.id,
    detail: `${user.name} signed in as ${user.role}${user.deptId ? ` (scoped to ${user.deptId})` : ""}`,
  });
  const res = NextResponse.json({ session, home: ROLE_HOME[user.role] });
  res.cookies.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
