import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureBooted } from "@/lib/engine";
import { capabilities } from "@/lib/rbac";

export async function GET() {
  ensureBooted();
  const session = await getSession();
  if (!session) return NextResponse.json({ session: null }, { status: 200 });
  return NextResponse.json({ session, capabilities: capabilities(session.role) });
}
