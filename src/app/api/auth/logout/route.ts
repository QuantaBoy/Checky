import { NextResponse } from "next/server";
import { SESSION_COOKIE, getSession } from "@/lib/auth";
import { ensureBooted } from "@/lib/engine";
import { store } from "@/lib/store";

export async function POST() {
  ensureBooted();
  const session = await getSession();
  if (session) {
    store.audit({
      actor: session.username,
      role: session.role,
      action: "auth.logout",
      entity: "User",
      entityId: session.userId,
      detail: `${session.name} signed out`,
    });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
