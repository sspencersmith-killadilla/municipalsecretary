import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { StatusPill } from "@/components/PublicLayout";
import { useSession } from "@/lib/session";
import { formatDate, ITEM_STATUS_LABELS, statusTone } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/staff/legislation/")({
  head: () => ({
    meta: [
      { title: "Legislative Files — CivicLedger Staff" },
      {
        name: "description",
        content: "Draft, search and manage ordinances, resolutions and other legislative files.",
      },
      { property: "og:title", content: "Legislative Files" },
      { property: "og:description", content: "Draft and manage the municipality's legislation." },
    ],
  }),
  component: StaffLegislation,
});

function StaffLegislation() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);

  const items = useQuery({
    queryKey: ["staff", "legislation", q, status],
    queryFn: async () => {
      let query = supabase
        .from("legislative_items")
        .select("id,title,status,file_number,assigned_number,sponsor,updated_at,item_types(name)")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (q.trim()) query = query.ilike("title", `%${q}%`);
      if (status) query = query.eq("status", status as never);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <StaffShell>
      <StaffHeader
        eyebrow="Drafting"
        title="Legislative files"
        description="Every ordinance, resolution, contract and appointment in the system."
        actions={
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-sm bg-seal px-3.5 py-2 text-sm font-semibold text-seal-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New file
          </button>
        }
      />

      <div className="p-6">
        <div className="flex flex-wrap gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles…"
            className="min-w-[220px] flex-1 rounded-sm border border-input bg-card px-3 py-2 text-sm"
          />
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-sm border border-input bg-card px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {Object.entries(ITEM_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-rule text-[0.68rem] uppercase tracking-wider text-muted-foreground">
              <th className="py-2 font-semibold">Number</th>
              <th className="py-2 font-semibold">Title</th>
              <th className="py-2 font-semibold">Type</th>
              <th className="py-2 font-semibold">Sponsor</th>
              <th className="py-2 font-semibold">Status</th>
              <th className="py-2 font-semibold">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(items.data ?? []).map((i) => (
              <tr key={i.id} className="hover:bg-accent/40">
                <td className="docnum py-2.5 text-seal">{i.assigned_number ?? i.file_number}</td>
                <td className="py-2.5">
                  <Link
                    to="/staff/legislation/$itemId"
                    params={{ itemId: i.id }}
                    className="font-medium text-foreground hover:text-seal"
                  >
                    {i.title}
                  </Link>
                </td>
                <td className="py-2.5 text-muted-foreground">
                  {(i.item_types as { name?: string } | null)?.name}
                </td>
                <td className="py-2.5 text-muted-foreground">{i.sponsor ?? "—"}</td>
                <td className="py-2.5">
                  <StatusPill
                    label={ITEM_STATUS_LABELS[i.status] ?? i.status}
                    tone={statusTone(i.status)}
                  />
                </td>
                <td className="docnum py-2.5 text-muted-foreground">{formatDate(i.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.data?.length === 0 && (
          <p className="py-8 text-sm text-muted-foreground">No files found.</p>
        )}
      </div>

      {creating ? <NewFileDialog onClose={() => setCreating(false)} /> : null}
    </StaffShell>
  );
}

function NewFileDialog({ onClose }: { onClose: () => void }) {
  const { userId } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [typeId, setTypeId] = useState("");
  const [bodyId, setBodyId] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [department, setDepartment] = useState("");

  const refs = useQuery({
    queryKey: ["staff", "refs"],
    queryFn: async () => {
      const [types, bodies] = await Promise.all([
        supabase.from("item_types").select("id,name").eq("active", true).order("sort_order"),
        supabase.from("bodies").select("id,name").eq("active", true).order("sort_order"),
      ]);
      if (types.error) throw types.error;
      if (bodies.error) throw bodies.error;
      return { types: types.data ?? [], bodies: bodies.data ?? [] };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("legislative_items")
        .insert({
          title,
          summary,
          item_type_id: typeId || null,
          body_id: bodyId || null,
          sponsor: sponsor || null,
          department: department || null,
          created_by: userId,
          status: "draft" as const,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["staff", "legislation"] });
      toast.success("Draft created");
      onClose();
      navigate({ to: "/staff/legislation/$itemId", params: { itemId: data.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create file"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="w-full max-w-lg rounded-sm border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">New legislative file</h2>
        <div className="mt-4 space-y-3">
          <Field label="Title" value={title} onChange={setTitle} />
          <label className="block">
            <span className="eyebrow">Summary</span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow">Type</span>
              <select
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                className="mt-1.5 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {(refs.data?.types ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="eyebrow">Body</span>
              <select
                value={bodyId}
                onChange={(e) => setBodyId(e.target.value)}
                className="mt-1.5 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {(refs.data?.bodies ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Sponsor" value={sponsor} onChange={setSponsor} />
            <Field label="Department" value={department} onChange={setDepartment} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-sm border border-input px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            disabled={!title.trim() || create.isPending}
            onClick={() => create.mutate()}
            className="rounded-sm bg-seal px-3.5 py-2 text-sm font-semibold text-seal-foreground disabled:opacity-50"
          >
            Create draft
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}
