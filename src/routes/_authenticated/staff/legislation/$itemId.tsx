import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { StatusPill } from "@/components/PublicLayout";
import { AttachmentsPanel } from "@/components/staff/AttachmentsPanel";

import { useSession } from "@/lib/session";
import { formatDateTime, ITEM_STATUS_LABELS, statusTone } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/staff/legislation/$itemId")({
  head: () => ({
    meta: [
      { title: "Edit Legislative File — CivicLedger Staff" },
      {
        name: "description",
        content: "Edit the text, routing and status of a legislative file before it reaches agenda.",
      },
      { property: "og:title", content: "Edit Legislative File" },
      { property: "og:description", content: "Draft text, route for approval and assign numbers." },
    ],
  }),
  component: EditItem,
});

function EditItem() {
  const { itemId } = Route.useParams();
  const { userId, canManage } = useSession();
  const queryClient = useQueryClient();

  const item = useQuery({
    queryKey: ["staff", "item", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legislative_items")
        .select("*, item_types(name,readings_required,default_workflow_template_id)")
        .eq("id", itemId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const workflow = useQuery({
    queryKey: ["staff", "workflow", itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_instances")
        .select("id,state,workflow_step_actions(id,step_name,step_order,state,comment,acted_at,approver_role)")
        .eq("item_id", itemId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const templates = useQuery({
    queryKey: ["staff", "workflow-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_templates")
        .select("id,name,workflow_steps(id,name,step_order,approver_role,required)")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    title: "",
    summary: "",
    body_text: "",
    fiscal_impact: "",
    sponsor: "",
    department: "",
  });

  useEffect(() => {
    if (!item.data) return;
    setForm({
      title: item.data.title ?? "",
      summary: item.data.summary ?? "",
      body_text: item.data.body_text ?? "",
      fiscal_impact: item.data.fiscal_impact ?? "",
      sponsor: item.data.sponsor ?? "",
      department: item.data.department ?? "",
    });
  }, [item.data?.id]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("legislative_items")
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq("id", itemId);
      if (error) throw error;
      await supabase.from("item_versions").insert({
        item_id: itemId,
        version: Date.now() % 100000,
        title: form.title,
        body_text: form.body_text,
        created_by: userId,
        note: "Saved from staff editor",
      });
    },
    onSuccess: () => {
      toast.success("Saved");
      queryClient.invalidateQueries({ queryKey: ["staff", "item", itemId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const assignNumber = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("assign_item_number", { _item_id: itemId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (num) => {
      toast.success(`Assigned ${num}`);
      queryClient.invalidateQueries({ queryKey: ["staff", "item", itemId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Numbering failed"),
  });

  const startWorkflow = useMutation({
    mutationFn: async (templateId: string) => {
      const tpl = (templates.data ?? []).find((t) => t.id === templateId);
      if (!tpl) throw new Error("Template not found");
      const { data: inst, error } = await supabase
        .from("workflow_instances")
        .insert({ item_id: itemId, template_id: templateId, state: "pending" as const })
        .select("id")
        .single();
      if (error) throw error;
      const steps = [...((tpl.workflow_steps ?? []) as StepTpl[])].sort(
        (a, b) => a.step_order - b.step_order,
      );
      const { error: e2 } = await supabase.from("workflow_step_actions").insert(
        steps.map((s) => ({
          instance_id: inst.id,
          step_id: s.id,
          step_name: s.name,
          step_order: s.step_order,
          approver_role: s.approver_role as never,
          state: "pending" as const,
        })),
      );
      if (e2) throw e2;
      await supabase.from("legislative_items").update({ status: "in_review" as const }).eq("id", itemId);
    },
    onSuccess: () => {
      toast.success("Routed for review");
      queryClient.invalidateQueries({ queryKey: ["staff", "workflow", itemId] });
      queryClient.invalidateQueries({ queryKey: ["staff", "item", itemId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not route"),
  });

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from("legislative_items")
        .update({ status: status as never })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["staff", "item", itemId] });
    },
  });

  const i = item.data;
  const steps = [...((workflow.data?.workflow_step_actions ?? []) as StepAction[])].sort(
    (a, b) => a.step_order - b.step_order,
  );

  return (
    <StaffShell>
      <StaffHeader
        eyebrow={(i?.item_types as { name?: string } | null)?.name ?? "Legislative file"}
        title={i?.title ?? "Loading…"}
        description={i ? `File ${i.file_number ?? "—"} · ${i.assigned_number ?? "no number assigned"}` : undefined}
        actions={
          <>
            {i ? (
              <StatusPill
                label={ITEM_STATUS_LABELS[i.status] ?? i.status}
                tone={statusTone(i.status)}
              />
            ) : null}
            <Link
              to="/legislation/$itemId"
              params={{ itemId }}
              className="rounded-sm border border-input px-3 py-2 text-sm"
            >
              Public view
            </Link>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="rounded-sm bg-seal px-3.5 py-2 text-sm font-semibold text-seal-foreground disabled:opacity-60"
            >
              Save
            </button>
          </>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Text label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <Area
            label="Summary"
            rows={3}
            value={form.summary}
            onChange={(v) => setForm({ ...form, summary: v })}
          />
          <Area
            label="Full text"
            rows={18}
            mono
            value={form.body_text}
            onChange={(v) => setForm({ ...form, body_text: v })}
          />
          <Area
            label="Fiscal impact"
            rows={3}
            value={form.fiscal_impact}
            onChange={(v) => setForm({ ...form, fiscal_impact: v })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Sponsor" value={form.sponsor} onChange={(v) => setForm({ ...form, sponsor: v })} />
            <Text
              label="Department"
              value={form.department}
              onChange={(v) => setForm({ ...form, department: v })}
            />
          </div>
          <AttachmentsPanel itemId={itemId} />
        </div>


        <aside className="space-y-5">
          <div className="rounded-sm border border-border bg-card p-4">
            <p className="eyebrow">Numbering</p>
            <p className="mt-1 font-display text-lg font-bold">{i?.assigned_number ?? "Unassigned"}</p>
            <button
              onClick={() => assignNumber.mutate()}
              disabled={!!i?.assigned_number || assignNumber.isPending}
              className="mt-2 w-full rounded-sm border border-input px-3 py-2 text-xs font-medium disabled:opacity-50"
            >
              Assign next number
            </button>
          </div>

          <div className="rounded-sm border border-border bg-card p-4">
            <p className="eyebrow">Approval routing</p>
            {steps.length === 0 ? (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted-foreground">Not routed yet.</p>
                <select
                  onChange={(e) => e.target.value && startWorkflow.mutate(e.target.value)}
                  defaultValue=""
                  className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-xs"
                >
                  <option value="">Route using template…</option>
                  {(templates.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <ol className="mt-2 space-y-2">
                {steps.map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-2 text-xs">
                    <span>
                      <span className="block font-medium text-foreground">{s.step_name}</span>
                      <span className="text-muted-foreground">{s.approver_role ?? "any staff"}</span>
                      {s.comment ? (
                        <span className="mt-0.5 block italic text-muted-foreground">{s.comment}</span>
                      ) : null}
                    </span>
                    <StatusPill
                      label={s.state}
                      tone={statusTone(
                        s.state === "approved" ? "adopted" : s.state === "rejected" ? "failed" : "in_review",
                      )}
                    />
                  </li>
                ))}
              </ol>
            )}
          </div>

          {canManage && (
            <div className="rounded-sm border border-border bg-card p-4">
              <p className="eyebrow">Clerk actions</p>
              <div className="mt-2 grid gap-1.5">
                {["approved", "scheduled", "adopted", "tabled", "failed", "withdrawn"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus.mutate(s)}
                    className="rounded-sm border border-input px-2 py-1.5 text-xs hover:bg-accent"
                  >
                    Mark {ITEM_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-sm border border-border bg-card p-4 text-xs text-muted-foreground">
            <p className="eyebrow">Record</p>
            <p className="mt-1">Created {formatDateTime(i?.created_at)}</p>
            <p>Updated {formatDateTime(i?.updated_at)}</p>
            <p>Readings completed: {i?.readings_completed ?? 0}</p>
          </div>
        </aside>
      </div>
    </StaffShell>
  );
}

type StepTpl = { id: string; name: string; step_order: number; approver_role: string | null };
type StepAction = {
  id: string;
  step_name: string;
  step_order: number;
  state: string;
  comment: string | null;
  approver_role: string | null;
};

function Text({
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
        className="mt-1.5 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm"
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  rows,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1.5 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm leading-relaxed ${mono ? "font-mono text-[0.82rem]" : ""}`}
      />
    </label>
  );
}
