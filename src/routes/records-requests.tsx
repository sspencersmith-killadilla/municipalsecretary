import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout, PageHeader, StatusPill } from "@/components/PublicLayout";
import { formatDate, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/records-requests")({
  head: () => ({
    meta: [
      { title: "Public Records Requests — Municipal Records Portal" },
      {
        name: "description",
        content:
          "File a public records request with the City Clerk, track its status by tracking code, and review the municipality's records retention schedule.",
      },
      { property: "og:title", content: "Public Records Requests" },
      {
        property: "og:description",
        content: "File and track a public records request with the City Clerk.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecordsRequests,
});

const REQUEST_LABELS: Record<string, string> = {
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

function RecordsRequests() {
  const [form, setForm] = useState({
    requester_name: "",
    requester_email: "",
    requester_phone: "",
    description: "",
  });
  const [filed, setFiled] = useState<{ tracking_code: string; due_at: string | null } | null>(null);
  const [code, setCode] = useState("");
  const [lookupCode, setLookupCode] = useState("");

  const settings = useQuery({
    queryKey: ["settings", "records"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("municipality_name,contact_email,records_response_days")
        .eq("id", 1)
        .maybeSingle();
      return data;
    },
  });

  const retention = useQuery({
    queryKey: ["public", "retention"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retention_policies")
        .select("*")
        .order("record_class");
      if (error) throw error;
      return data ?? [];
    },
  });

  const lookup = useQuery({
    queryKey: ["public", "records-request", lookupCode],
    enabled: lookupCode.length > 0,
    queryFn: async () => {
      return await lookupRequest({ data: { tracking_code: lookupCode } });
    },
  });

  const file = useMutation({
    mutationFn: async () => {
      if (!form.requester_name.trim() || !form.description.trim()) {
        throw new Error("Name and description of records are required.");
      }
      return await fileRequest({
        data: {
          requester_name: form.requester_name,
          description: form.description,
          requester_email: form.requester_email,
          requester_phone: form.requester_phone,
        },
      });
    },
    onSuccess: (data) => {
      setFiled(data);
      setForm({ requester_name: "", requester_email: "", requester_phone: "", description: "" });
      toast.success(`Request filed — tracking code ${data.tracking_code}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const days = settings.data?.records_response_days ?? 5;
  const result = lookup.data;

  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Open records"
        title="Public records requests"
        description={`Request copies of municipal records from the Clerk's office. Requests are acknowledged and answered within ${days} business days as required by law; some records may be withheld or redacted under statutory exemptions.`}
      />

      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-12 lg:grid-cols-[1fr_300px]">
        <div className="space-y-10">
          <section className="paper rounded-sm p-6">
            <h2 className="font-display text-xl font-bold">File a request</h2>
            {filed ? (
              <div className="mt-4 rounded-sm border border-seal/30 bg-seal/5 p-4 text-sm">
                <p className="font-semibold text-foreground">Request received.</p>
                <p className="mt-1 text-muted-foreground">
                  Your tracking code is{" "}
                  <span className="docnum font-semibold text-seal">{filed.tracking_code}</span>. Save
                  it — you can check the status of your request below at any time.
                  {filed.due_at ? ` Statutory response due ${formatDate(filed.due_at)}.` : ""}
                </p>
                <button
                  type="button"
                  onClick={() => setFiled(null)}
                  className="mt-3 rounded-sm border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  File another request
                </button>
              </div>
            ) : (
              <form
                className="mt-4 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  file.mutate();
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Your name *"
                    value={form.requester_name}
                    onChange={(v) => setForm({ ...form, requester_name: v })}
                  />
                  <Field
                    label="Email"
                    type="email"
                    value={form.requester_email}
                    onChange={(v) => setForm({ ...form, requester_email: v })}
                  />
                </div>
                <Field
                  label="Phone (optional)"
                  value={form.requester_phone}
                  onChange={(v) => setForm({ ...form, requester_phone: v })}
                />
                <label className="block">
                  <span className="eyebrow">Records requested *</span>
                  <textarea
                    required
                    rows={6}
                    maxLength={8000}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe the records you are seeking, including dates, departments and subject matter."
                    className="mt-1.5 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm leading-relaxed"
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  Requests and responses are themselves public records. Fees may apply for
                  duplication or extensive staff time; you will be notified before charges are
                  incurred.
                </p>
                <button
                  type="submit"
                  disabled={file.isPending}
                  className="rounded-sm bg-seal px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {file.isPending ? "Filing…" : "Submit request"}
                </button>
              </form>
            )}
          </section>

          <section className="paper rounded-sm p-6">
            <h2 className="font-display text-xl font-bold">Track a request</h2>
            <form
              className="mt-4 flex flex-wrap gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                setLookupCode(code.trim().toUpperCase());
              }}
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Tracking code"
                aria-label="Tracking code"
                className="docnum min-w-[12rem] flex-1 rounded-sm border border-input bg-background px-3 py-2 text-sm uppercase"
              />
              <button
                type="submit"
                className="rounded-sm border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Check status
              </button>
            </form>

            {lookupCode && !lookup.isLoading ? (
              result ? (
                <div className="mt-5 space-y-2 border-t border-rule pt-4 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="docnum text-seal">{result.tracking_code}</span>
                    <StatusPill
                      label={REQUEST_LABELS[result.status] ?? result.status}
                      tone={tone(result.status)}
                    />
                  </div>
                  <p className="text-muted-foreground">{result.description}</p>
                  <p className="docnum text-xs text-muted-foreground">
                    Received {formatDateTime(result.received_at)}
                    {result.due_at ? ` · Response due ${formatDate(result.due_at)}` : ""}
                    {result.closed_at ? ` · Closed ${formatDate(result.closed_at)}` : ""}
                  </p>
                  {result.response_note ? (
                    <p className="rounded-sm border border-rule bg-secondary p-3 text-sm text-foreground">
                      {result.response_note}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No request found for that tracking code.
                </p>
              )
            ) : null}
          </section>

          <section>
            <h2 className="border-b border-rule pb-2 font-display text-xl font-bold">
              Records retention schedule
            </h2>
            <ul className="divide-y divide-border">
              {(retention.data ?? []).map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline gap-3 py-3 text-sm">
                  <span className="min-w-0 flex-1 font-medium text-foreground">{r.label}</span>
                  <span className="docnum text-xs text-muted-foreground">
                    {r.permanent ? "Permanent" : `${r.retention_years ?? "—"} years`}
                  </span>
                  {r.citation ? (
                    <span className="docnum text-xs text-muted-foreground">{r.citation}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="paper rounded-sm p-5 text-sm">
            <p className="eyebrow">Clerk's office</p>
            <p className="mt-1 text-foreground">
              {settings.data?.municipality_name ?? "City Clerk"}
            </p>
            {settings.data?.contact_email ? (
              <a
                href={`mailto:${settings.data.contact_email}`}
                className="text-seal underline"
              >
                {settings.data.contact_email}
              </a>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">
              Many records — agendas, minutes, ordinances and resolutions — are already published in
              this portal and need no request.
            </p>
          </div>
        </aside>
      </div>
    </PublicLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}
