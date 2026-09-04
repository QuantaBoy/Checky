import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ensureBooted } from "@/lib/engine";
import { ROLE_HOME } from "@/lib/rbac";

/** Each role lands on the screen it actually works from (Website Flow §1). */
export default async function Home() {
  ensureBooted();
  const session = await getSession();
  redirect(session ? ROLE_HOME[session.role] : "/login");
}
