import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/staff/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail — CivicLedger Staff" },
      {
        name: "description",
        content:
          "Immutable log of numbering, adoption, certification and records activity across the legislative system.",
      },
      { property: "og:title", content: "Audit Trail" },
      { property: "og:description", content: "Immutable activity log for the clerk's office." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditTrail,
});

function AuditTrail() {
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");

  const entries = useQuery({
    queryKey: ["staff", "audit", entityType, action],
    queryFn: async () => {
      let q = supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (entityType) q = q.eq("entity_type", entityType);
      if (action) q = q.eq("action", action);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const actors = useQuery({
    queryKey: ["staff", "audit-actors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name,email");
      if (error) throw error;
      return data ?? [];
    },
  });

  const actorMap = useMemo(
    () => new Map((actors.data ?? []).map((p) => [p.id, p.full_name || p.email || p.id])),
    [actors.data],
  );

  const facets = useQuery({
    queryKey: ["staff", "audit-facets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("entity_type,action")
        .limit(2000);
      if (error) throw error;
      return {
        types: [...new Set((data ?? []).map((r) => r.entity_type))].sort(),
        actions: [...new Set((data ?? []).map((r) => r.action))].sort(),
      };
    },
  });

  const rows = (entries.data ?? []).filter((e) => {
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return (
      (e.detail ?? "").toLowerCase().includes(needle) ||
      e.action.toLowerCase().includes(needle) ||
      e.entity_type.toLowerCase().includes(needle) ||
      (e.entity_id ?? "").toLowerCase().includes(needle)
    );
  });

  return (
    <StaffShell>
      <StaffHeader
        title="Audit trail"
        subtitle="Append-only record of system activity. Entries cannot be edited or deleted."
      />

      <div className="mt-5 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search detail, action or record id…"
          aria-label="Search audit entries"
          className="min-w-[240px] flex-1 rounded-sm border border-input bg-card px-3 py-2 text-sm"
        />
        <select
          aria-label="Filter by record type"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="rounded-sm border border-input bg-card px-3 py-2 text-sm"
        >
          <option value="">All record types</option>
          {(facets.data?.types ?? []).map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-sm border border-input bg-card px-3 py-2 text-sm"
        >
          <option value="">All actions</option>
          {(facets.data?.actions ?? []).map((a) => (
            <option key={a} value={a}>
              {a.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-sm border border-rule bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Audit log entries, newest first</caption>
          <thead className="border-b border-rule bg-muted/40">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">
                When
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Actor
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Record
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Action
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Detail
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.isLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                  Loading audit entries…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                  No audit entries match these filters.
                </td>
              </tr>
            ) : (
              rows.map((e) => (
                <tr key={e.id} className="border-b border-rule/60 last:border-0 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {formatDateTime(e.created_at)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {e.actor_id ? (actorMap.get(e.actor_id) ?? "Staff user") : "System"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="font-semibold">{e.entity_type.replace(/_/g, " ")}</span>
                    {e.entity_id ? (
                      <span className="docnum block text-[0.65rem] text-muted-foreground">
                        {e.entity_id.slice(0, 8)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs font-semibold">{e.action.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{e.detail ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Showing the most recent {rows.length} of up to 500 loaded entries. Audit rows are
        write-once: no role — including administrators — can update or delete them.
      </p>
    </StaffShell>
  );
}
