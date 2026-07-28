import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { StatusPill } from "@/components/PublicLayout";
import { useSession } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/staff/records")({
  head: () => ({
    meta: [
      { title: "Records Management — CivicLedger Staff" },
      {
        name: "description",
        content:
          "Process public records requests, maintain the retention schedule and place or release legal holds.",
      },
      { property: "og:title", content: "Records Management" },
      {
        property: "og:description",
        content: "Public records requests, retention schedule and legal holds.",
      },
    ],
  }),
  component: RecordsAdmin,
});

const STATUSES = [
  "received",
  "in_progress",
  "awaiting_clarification",
  "fulfilled",
  "denied",
  "withdrawn",
] as const;
type RequestStatus = (typeof STATUSES)[number];

const LABELS: Record<string, string> = {
  received: "Received",
  in_progress: "In progress",
  awaiting_clarification: "Awaiting clarification",
  fulfilled: "Fulfilled",
  denied: "Denied",
  withdrawn: "Withdrawn",
};

function tone(status: string) {
  if (status === "fulfilled") return "border-emerald-700/30 bg-emerald-700/10 text-emerald-900";
  if (status === "denied" || status === "withdrawn")
    return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-seal/30 bg-seal/10 text-seal";
}

const TABS = [
  { key: "requests", label: "Records requests" },
  { key: "retention", label: "Retention schedule" },
  { key: "holds", label: "Legal holds" },
] as const;

function RecordsAdmin() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("requests");

  return (
    <StaffShell>
      <StaffHeader
        title="Records management"
        description="Public records (FOIA) requests, the municipal retention schedule, and legal holds that suspend destruction."
      />
      <div className="border-b border-rule bg-card px-6">
        <nav className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm ${
                tab === t.key
                  ? "border-seal font-semibold text-seal"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="p-6">
        {tab === "requests" && <RequestQueue />}
        {tab === "retention" && <RetentionSchedule />}
        {tab === "holds" && <LegalHolds />}
      </div>
    </StaffShell>
  );
}

function RequestQueue() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const requests = useQuery({
    queryKey: ["staff", "records-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("records_requests")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const events = useQuery({
    queryKey: ["staff", "records-request-events", openId],
    enabled: !!openId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("records_request_events")
        .select("*")
        .eq("request_id", openId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async (input: {
      id: string;
      status?: RequestStatus;
      response_note?: string;
      redaction_note?: string;
      fee_estimate?: number | null;
      note?: string;
      action: string;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const patch: Record<string, unknown> = {};
      if (input.status) {
        patch.status = input.status;
        patch.closed_at = ["fulfilled", "denied", "withdrawn"].includes(input.status)
          ? new Date().toISOString()
          : null;
      }
      if (input.response_note !== undefined) patch.response_note = input.response_note || null;
      if (input.redaction_note !== undefined) patch.redaction_note = input.redaction_note || null;
      if (input.fee_estimate !== undefined) patch.fee_estimate = input.fee_estimate;
      patch.assigned_to = auth.user?.id ?? null;

      const { error } = await supabase.from("records_requests").update(patch).eq("id", input.id);
      if (error) throw error;
      await supabase.from("records_request_events").insert({
        request_id: input.id,
        action: input.action,
        note: input.note ?? null,
        actor_id: auth.user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Request updated");
      qc.invalidateQueries({ queryKey: ["staff", "records-requests"] });
      qc.invalidateQueries({ queryKey: ["staff", "records-request-events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = requests.data ?? [];
  const open = rows.find((r) => r.id === openId) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="rounded-sm border border-border bg-card">
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const overdue =
              r.due_at && !r.closed_at && new Date(r.due_at).getTime() < Date.now();
            return (
              <li key={r.id}>
                <button
                  onClick={() => setOpenId(r.id)}
                  className={`flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 ${
                    openId === r.id ? "bg-accent/60" : ""
                  }`}
                >
                  <span className="docnum text-seal">{r.tracking_code}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {r.requester_name} — {r.description}
                  </span>
                  {overdue ? (
                    <StatusPill
                      label="Overdue"
                      tone="border-destructive/30 bg-destructive/10 text-destructive"
                    />
                  ) : null}
                  <StatusPill label={LABELS[r.status] ?? r.status} tone={tone(r.status)} />
                </button>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="px-4 py-6 text-sm text-muted-foreground">
              No records requests have been filed.
            </li>
          )}
        </ul>
      </div>

      <aside>
        {open ? (
          <RequestDetail
            key={open.id}
            request={open}
            events={events.data ?? []}
            onSave={(payload) => update.mutate({ id: open.id, ...payload })}
            saving={update.isPending}
          />
        ) : (
          <p className="rounded-sm border border-dashed border-border p-6 text-sm text-muted-foreground">
            Select a request to respond, log correspondence, note redactions or close it out.
          </p>
        )}
      </aside>
    </div>
  );
}

type RequestRow = {
  id: string;
  tracking_code: string;
  requester_name: string;
  requester_email: string | null;
  requester_phone: string | null;
  description: string;
  status: string;
  received_at: string;
  due_at: string | null;
  closed_at: string | null;
  response_note: string | null;
  redaction_note: string | null;
  fee_estimate: number | null;
};

function RequestDetail({
  request,
  events,
  onSave,
  saving,
}: {
  request: RequestRow;
  events: { id: string; action: string; note: string | null; created_at: string }[];
  onSave: (payload: {
    status?: RequestStatus;
    response_note?: string;
    redaction_note?: string;
    fee_estimate?: number | null;
    note?: string;
    action: string;
  }) => void;
  saving: boolean;
}) {
  const [status, setStatus] = useState<RequestStatus>(request.status as RequestStatus);
  const [response, setResponse] = useState(request.response_note ?? "");
  const [redaction, setRedaction] = useState(request.redaction_note ?? "");
  const [fee, setFee] = useState(request.fee_estimate?.toString() ?? "");
  const [note, setNote] = useState("");

  return (
    <div className="space-y-4 rounded-sm border border-border bg-card p-5">
      <div>
        <p className="docnum text-seal">{request.tracking_code}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{request.requester_name}</p>
        <p className="docnum text-xs text-muted-foreground">
          {request.requester_email ?? "no email"} · {request.requester_phone ?? "no phone"}
        </p>
        <p className="docnum mt-1 text-xs text-muted-foreground">
          Received {formatDateTime(request.received_at)}
          {request.due_at ? ` · Due ${formatDate(request.due_at)}` : ""}
        </p>
      </div>

      <p className="rounded-sm border border-rule bg-secondary p-3 text-sm leading-relaxed">
        {request.description}
      </p>

      <label className="block">
        <span className="eyebrow">Status</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as RequestStatus)}
          className="mt-1.5 w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="eyebrow">Response to requester (published on the tracking page)</span>
        <textarea
          rows={4}
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          className="mt-1.5 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="eyebrow">Redaction / exemption citation (internal)</span>
        <textarea
          rows={2}
          value={redaction}
          onChange={(e) => setRedaction(e.target.value)}
          placeholder="e.g. personnel records exemption; attorney-client privilege"
          className="mt-1.5 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="eyebrow">Fee estimate (USD)</span>
        <input
          type="number"
          step="0.01"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          className="mt-1.5 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="eyebrow">Log note</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Correspondence, extension notice, clarification sent…"
          className="mt-1.5 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
        />
      </label>

      <button
        disabled={saving}
        onClick={() =>
          onSave({
            status,
            response_note: response,
            redaction_note: redaction,
            fee_estimate: fee ? Number(fee) : null,
            note: note || undefined,
            action: `status_${status}`,
          })
        }
        className="w-full rounded-sm bg-seal px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save and log"}
      </button>

      <div>
        <p className="eyebrow">Request log</p>
        <ul className="mt-2 space-y-1.5">
          {events.map((e) => (
            <li key={e.id} className="text-xs text-muted-foreground">
              <span className="docnum">{formatDateTime(e.created_at)}</span> — {e.action}
              {e.note ? `: ${e.note}` : ""}
            </li>
          ))}
          {events.length === 0 && <li className="text-xs text-muted-foreground">No activity yet.</li>}
        </ul>
      </div>
    </div>
  );
}

function RetentionSchedule() {
  const qc = useQueryClient();
  const { canManage } = useSession();
  const [draft, setDraft] = useState({
    record_class: "",
    label: "",
    permanent: false,
    retention_years: "5",
    citation: "",
    note: "",
  });

  const policies = useQuery({
    queryKey: ["staff", "retention"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retention_policies")
        .select("*")
        .order("record_class");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (row: {
      id?: string;
      record_class: string;
      label: string;
      permanent: boolean;
      retention_years: number | null;
      citation: string | null;
      note: string | null;
    }) => {
      if (row.id) {
        const { error } = await supabase
          .from("retention_policies")
          .update({
            label: row.label,
            permanent: row.permanent,
            retention_years: row.permanent ? null : row.retention_years,
            citation: row.citation,
            note: row.note,
          })
          .eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("retention_policies").insert({
          record_class: row.record_class,
          label: row.label,
          permanent: row.permanent,
          retention_years: row.permanent ? null : row.retention_years,
          citation: row.citation,
          note: row.note,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Retention schedule saved");
      qc.invalidateQueries({ queryKey: ["staff", "retention"] });
      setDraft({
        record_class: "",
        label: "",
        permanent: false,
        retention_years: "5",
        citation: "",
        note: "",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-sm border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-rule text-left">
            <tr className="eyebrow">
              <th className="px-4 py-2">Record class</th>
              <th className="px-4 py-2">Label</th>
              <th className="px-4 py-2">Retention</th>
              <th className="px-4 py-2">Citation</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(policies.data ?? []).map((p) => (
              <PolicyRow
                key={p.id}
                policy={p}
                canManage={canManage}
                onSave={(patch) => save.mutate({ id: p.id, record_class: p.record_class, ...patch })}
              />
            ))}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div className="rounded-sm border border-border bg-card p-5">
          <p className="eyebrow">Add a record class</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Record class key"
              value={draft.record_class}
              onChange={(v) => setDraft({ ...draft, record_class: v })}
            />
            <Input
              label="Label"
              value={draft.label}
              onChange={(v) => setDraft({ ...draft, label: v })}
            />
            <Input
              label="Retention years"
              value={draft.retention_years}
              onChange={(v) => setDraft({ ...draft, retention_years: v })}
            />
            <Input
              label="Citation"
              value={draft.citation}
              onChange={(v) => setDraft({ ...draft, citation: v })}
            />
            <label className="flex items-end gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.permanent}
                onChange={(e) => setDraft({ ...draft, permanent: e.target.checked })}
              />
              Permanent record
            </label>
            <button
              onClick={() =>
                save.mutate({
                  record_class: draft.record_class.trim(),
                  label: draft.label.trim(),
                  permanent: draft.permanent,
                  retention_years: draft.permanent ? null : Number(draft.retention_years) || null,
                  citation: draft.citation.trim() || null,
                  note: draft.note.trim() || null,
                })
              }
              disabled={!draft.record_class.trim() || !draft.label.trim() || save.isPending}
              className="self-end rounded-sm bg-seal px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Add class
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PolicyRow({
  policy,
  canManage,
  onSave,
}: {
  policy: {
    id: string;
    record_class: string;
    label: string;
    permanent: boolean;
    retention_years: number | null;
    citation: string | null;
    note: string | null;
  };
  canManage: boolean;
  onSave: (patch: {
    label: string;
    permanent: boolean;
    retention_years: number | null;
    citation: string | null;
    note: string | null;
  }) => void;
}) {
  const [label, setLabel] = useState(policy.label);
  const [permanent, setPermanent] = useState(policy.permanent);
  const [years, setYears] = useState(policy.retention_years?.toString() ?? "");
  const [citation, setCitation] = useState(policy.citation ?? "");

  return (
    <tr>
      <td className="docnum px-4 py-2 text-xs text-muted-foreground">{policy.record_class}</td>
      <td className="px-4 py-2">
        <input
          value={label}
          disabled={!canManage}
          onChange={(e) => setLabel(e.target.value)}
          aria-label={`Label for ${policy.record_class}`}
          className="w-full rounded-sm border border-input bg-background px-2 py-1 text-sm"
        />
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={permanent}
              disabled={!canManage}
              onChange={(e) => setPermanent(e.target.checked)}
            />
            Permanent
          </label>
          {!permanent && (
            <input
              value={years}
              disabled={!canManage}
              onChange={(e) => setYears(e.target.value)}
              aria-label={`Retention years for ${policy.record_class}`}
              className="w-16 rounded-sm border border-input bg-background px-2 py-1 text-sm"
            />
          )}
        </div>
      </td>
      <td className="px-4 py-2">
        <input
          value={citation}
          disabled={!canManage}
          onChange={(e) => setCitation(e.target.value)}
          aria-label={`Citation for ${policy.record_class}`}
          className="w-full rounded-sm border border-input bg-background px-2 py-1 text-sm"
        />
      </td>
      <td className="px-4 py-2 text-right">
        {canManage && (
          <button
            onClick={() =>
              onSave({
                label,
                permanent,
                retention_years: permanent ? null : Number(years) || null,
                citation: citation || null,
                note: policy.note,
              })
            }
            className="rounded-sm border border-input px-3 py-1 text-xs font-medium hover:bg-accent"
          >
            Save
          </button>
        )}
      </td>
    </tr>
  );
}

function LegalHolds() {
  const qc = useQueryClient();
  const { canManage } = useSession();
  const [draft, setDraft] = useState({ record_class: "", reason: "", scope_note: "" });

  const holds = useQuery({
    queryKey: ["staff", "legal-holds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_holds")
        .select("*")
        .order("placed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const place = useMutation({
    mutationFn: async () => {
      if (!draft.record_class.trim() || !draft.reason.trim()) {
        throw new Error("Record class and reason are required.");
      }
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("legal_holds").insert({
        record_class: draft.record_class.trim(),
        reason: draft.reason.trim(),
        scope_note: draft.scope_note.trim() || null,
        placed_by: auth.user?.id ?? null,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Legal hold placed");
      setDraft({ record_class: "", reason: "", scope_note: "" });
      qc.invalidateQueries({ queryKey: ["staff", "legal-holds"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const release = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("legal_holds")
        .update({ active: false, released_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hold released");
      qc.invalidateQueries({ queryKey: ["staff", "legal-holds"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        A legal hold suspends scheduled destruction for a class of records during litigation,
        investigation or an open records dispute. Holds are logged with the placing official and
        remain visible until formally released.
      </p>

      {canManage && (
        <div className="rounded-sm border border-border bg-card p-5">
          <p className="eyebrow">Place a hold</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Input
              label="Record class"
              value={draft.record_class}
              onChange={(v) => setDraft({ ...draft, record_class: v })}
            />
            <Input
              label="Reason"
              value={draft.reason}
              onChange={(v) => setDraft({ ...draft, reason: v })}
            />
            <Input
              label="Scope note"
              value={draft.scope_note}
              onChange={(v) => setDraft({ ...draft, scope_note: v })}
            />
          </div>
          <button
            onClick={() => place.mutate()}
            disabled={place.isPending}
            className="mt-3 rounded-sm bg-seal px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Place hold
          </button>
        </div>
      )}

      <ul className="divide-y divide-border rounded-sm border border-border bg-card">
        {(holds.data ?? []).map((h) => (
          <li key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <span className="docnum text-xs text-muted-foreground">{h.record_class}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-foreground">{h.reason}</span>
              {h.scope_note ? (
                <span className="block text-xs text-muted-foreground">{h.scope_note}</span>
              ) : null}
            </span>
            <span className="docnum text-xs text-muted-foreground">
              Placed {formatDate(h.placed_at)}
              {h.released_at ? ` · Released ${formatDate(h.released_at)}` : ""}
            </span>
            <StatusPill
              label={h.active ? "Active" : "Released"}
              tone={
                h.active
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border bg-secondary text-muted-foreground"
              }
            />
            {canManage && h.active && (
              <button
                onClick={() => release.mutate(h.id)}
                className="rounded-sm border border-input px-3 py-1 text-xs font-medium hover:bg-accent"
              >
                Release
              </button>
            )}
          </li>
        ))}
        {(holds.data ?? []).length === 0 && (
          <li className="px-4 py-6 text-sm text-muted-foreground">No legal holds on file.</li>
        )}
      </ul>
    </div>
  );
}

function Input({
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
