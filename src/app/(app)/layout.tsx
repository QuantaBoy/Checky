import { redirect } from "next/navigation";
import { Shell } from "@/components/Shell";
import { getSession } from "@/lib/auth";
import { ensureBooted } from "@/lib/engine";
import { capabilities } from "@/lib/rbac";

/**
 * Every authenticated page renders through here, so the session check is one gate
 * rather than a per-page decision that a new page could forget to make.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  ensureBooted();
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <Shell session={session} capabilities={capabilities(session.role)}>
      {children}
    </Shell>
  );
}
