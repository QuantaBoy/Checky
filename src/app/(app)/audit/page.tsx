"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Empty, Panel, Spinner, Stat, Table, Td, Th, inputClass, ist } from "@/components/ui";
import type { AuditLog } from "@/lib/types";

export default function AuditPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [chain, setChain] = useState<{ valid: boolean; checked: number; brokenAtSeq?: number } | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");

  useEffect(() => {
    fetch("/api/audit?limit=800")
      .then((r) => r.json())
      .then((d) => {
        setRows(d.audit ?? []);
        setChain(d.chain ?? null);
        setActions(d.actions ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) => (!action || r.action === action) && (!s || `${r.actor} ${r.action} ${r.entity} ${r.entityId} ${r.detail}`.toLowerCase().includes(s)),
    );
  }, [rows, q, action]);

  if (loading) return <Spinner label="Loading audit trail" />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Entries" value={rows.length} sub="most recent first" />
        <Stat label="Distinct actions" value={actions.length} />
        <Stat
          label="Chain integrity"
          value={chain?.valid ? "VALID" : "BROKEN"}
          sub={chain?.valid ? `${chain.checked} entries verified` : `first break at seq ${chain?.brokenAtSeq}`}
          tone={chain?.valid ? "ok" : "alarm"}
        />
        <Stat label="Actors" value={new Set(rows.map((r) => r.actor)).size} />
      </div>

      <Panel
        title="Audit trail"
        subtitle="Every onboarding, access, watchlist change, alert action and export. Each entry hashes the previous one, so a deleted or back-dated row breaks the chain."
        actions={
          <div className="flex items-center gap-1.5">
            <input className={`${inputClass} w-52`} placeholder="Search actor, entity, detail…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className={`${inputClass} w-48`} value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        }
        bodyClassName="p-0"
      >
        {!filtered.length ? (
          <Empty>No audit entries match.</Empty>
        ) : (
          <div className="max-h-[640px] overflow-auto">
            <Table>
              <thead>
                <tr>
                  <Th className="text-right">Seq</Th>
                  <Th>Timestamp (IST)</Th>
                  <Th>Actor</Th>
                  <Th>Role</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>Detail</Th>
                  <Th>Hash</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-ink-800/50">
                    <Td className="text-right font-mono text-mist-400">{r.seq}</Td>
                    <Td className="font-mono text-mist-400">{ist(r.timestamp)}</Td>
                    <Td className="text-mist-100">{r.actor}</Td>
                    <Td>
                      <Badge tone={r.role === "system" ? "signal" : "neutral"}>{r.role}</Badge>
                    </Td>
                    <Td className="font-mono text-saffron-300">{r.action}</Td>
                    <Td className="text-mist-300">
                      {r.entity}
                      <span className="text-mist-400"> · {r.entityId}</span>
                    </Td>
                    <Td className="max-w-[32rem] text-mist-300">{r.detail}</Td>
                    <Td className="font-mono text-[9.5px] text-mist-400" title={`prev ${r.prevHash}`}>
                      {r.hash.slice(0, 12)}…
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}
