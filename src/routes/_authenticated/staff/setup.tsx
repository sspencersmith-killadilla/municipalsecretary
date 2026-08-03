import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/staff/setup")({
  head: () => ({
    meta: [
      { title: "Setup Wizard — CivicLedger Staff" },
      {
        name: "description",
        content:
          "Configure your municipality name, notice rules, governing bodies and public portal in a guided sequence.",
      },
      { property: "og:title", content: "CivicLedger Setup Wizard" },
      {
        property: "og:description",
        content: "Guided first-run configuration for a new city instance.",
      },
    ],
  }),
  component: SetupWizard,
});

const STEPS = ["Municipality", "Notice rules", "Governing bodies", "Go live"] as const;

function SetupWizard() {
  const { isAdmin } = useSession();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });

  const bodies = useQuery({
    queryKey: ["setup", "bodies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bodies")
        .select("id,name,seat_count,meeting_cadence,default_location,active")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    municipality_name: "",
    tagline: "",
    contact_email: "",
    website_url: "",
    logo_url: "",
    timezone: "America/New_York",
    notice_days: 7,
    posting_deadline_hours: 48,
    records_response_days: 5,
    public_comment_enabled: true,
  });

  useEffect(() => {
    if (settings.data) {
      setForm((f) => ({
        ...f,
        municipality_name: settings.data.municipality_name ?? "",
        tagline: settings.data.tagline ?? "",
        contact_email: settings.data.contact_email ?? "",
        website_url: settings.data.website_url ?? "",
        logo_url: settings.data.logo_url ?? "",
        timezone: settings.data.timezone ?? "America/New_York",
        notice_days: settings.data.notice_days,
        posting_deadline_hours: settings.data.posting_deadline_hours,
        records_response_days: settings.data.records_response_days,
        public_comment_enabled: settings.data.public_comment_enabled,
      }));
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async (patch: TablesUpdate<"settings">) => {
      const { error } = await supabase.from("settings").update(patch).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newBody, setNewBody] = useState({
    name: "",
    seat_count: 7,
    meeting_cadence: "Monthly",
    default_location: "",
  });

  const addBody = useMutation({
    mutationFn: async () => {
      const slug = newBody.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const { error } = await supabase.from("bodies").insert({
        name: newBody.name,
        slug,
        seat_count: newBody.seat_count,
        meeting_cadence: newBody.meeting_cadence,
        default_location: newBody.default_location || null,
        quorum_type: "majority",
        sort_order: (bodies.data?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewBody({ name: "", seat_count: 7, meeting_cadence: "Monthly", default_location: "" });
      qc.invalidateQueries({ queryKey: ["setup", "bodies"] });
      toast.success("Body created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const finish = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("settings")
        .update({ setup_completed_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Setup marked complete");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <StaffShell>
        <StaffHeader eyebrow="Onboarding" title="Setup wizard" />
        <div className="p-6">
          <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            Only administrators can run the setup wizard.
          </div>
        </div>
      </StaffShell>
    );
  }

  return (
    <StaffShell>
      <StaffHeader
        eyebrow="Onboarding"
        title="Setup wizard"
        description="Four steps to get a new city instance ready for its first posted agenda."
      />
      <div className="space-y-6 p-6">
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((label, i) => (
            <li key={label}>
              <button
                onClick={() => setStep(i)}
                className={`flex items-center gap-2 rounded-sm border px-3 py-1.5 text-sm ${
                  step === i ? "border-primary bg-primary/10 text-primary" : "border-border"
                }`}
              >
                {i < step ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4 opacity-50" />
                )}
                {i + 1}. {label}
              </button>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <Panel
            title="Municipality identity"
            hint="This appears on every published agenda, notice and PDF."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Municipality name"
                value={form.municipality_name}
                onChange={(v) => setForm({ ...form, municipality_name: v })}
              />
              <Field
                label="Tagline"
                value={form.tagline}
                onChange={(v) => setForm({ ...form, tagline: v })}
              />
              <Field
                label="Clerk contact email"
                value={form.contact_email}
                onChange={(v) => setForm({ ...form, contact_email: v })}
              />
              <Field
                label="City website"
                value={form.website_url}
                onChange={(v) => setForm({ ...form, website_url: v })}
              />
              <Field
                label="Seal or logo URL"
                value={form.logo_url}
                onChange={(v) => setForm({ ...form, logo_url: v })}
              />
              <Field
                label="Time zone"
                value={form.timezone}
                onChange={(v) => setForm({ ...form, timezone: v })}
              />
            </div>
            <SaveRow
              onSave={() =>
                save.mutate({
                  municipality_name: form.municipality_name,
                  tagline: form.tagline || null,
                  contact_email: form.contact_email || null,
                  website_url: form.website_url || null,
                  logo_url: form.logo_url || null,
                  timezone: form.timezone,
                })
              }
              onNext={() => setStep(1)}
              pending={save.isPending}
            />
          </Panel>
        )}

        {step === 1 && (
          <Panel
            title="Notice and records rules"
            hint="Match these to your state's open meetings and public records statutes."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Field
                label="Notice days before a meeting"
                type="number"
                value={String(form.notice_days)}
                onChange={(v) => setForm({ ...form, notice_days: Number(v) })}
              />
              <Field
                label="Agenda posting deadline (hours)"
                type="number"
                value={String(form.posting_deadline_hours)}
                onChange={(v) => setForm({ ...form, posting_deadline_hours: Number(v) })}
              />
              <Field
                label="Records response days"
                type="number"
                value={String(form.records_response_days)}
                onChange={(v) => setForm({ ...form, records_response_days: Number(v) })}
              />
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.public_comment_enabled}
                onChange={(e) => setForm({ ...form, public_comment_enabled: e.target.checked })}
              />
              Accept written public comment through the portal
            </label>
            <SaveRow
              onSave={() =>
                save.mutate({
                  notice_days: form.notice_days,
                  posting_deadline_hours: form.posting_deadline_hours,
                  records_response_days: form.records_response_days,
                  public_comment_enabled: form.public_comment_enabled,
                })
              }
              onNext={() => setStep(2)}
              pending={save.isPending}
            />
          </Panel>
        )}

        {step === 2 && (
          <Panel
            title="Governing bodies"
            hint="Add the council plus any boards and commissions that post agendas."
          >
            <ul className="mb-4 space-y-2 text-sm">
              {(bodies.data ?? []).map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border px-3 py-2"
                >
                  <span className="font-medium">{b.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {b.seat_count} seats · {b.meeting_cadence ?? "cadence not set"} ·{" "}
                    {b.default_location ?? "location not set"}
                  </span>
                </li>
              ))}
              {!bodies.data?.length && (
                <li className="text-muted-foreground">No bodies configured yet.</li>
              )}
            </ul>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field
                label="Name"
                value={newBody.name}
                onChange={(v) => setNewBody({ ...newBody, name: v })}
              />
              <Field
                label="Seats"
                type="number"
                value={String(newBody.seat_count)}
                onChange={(v) => setNewBody({ ...newBody, seat_count: Number(v) })}
              />
              <Field
                label="Cadence"
                value={newBody.meeting_cadence}
                onChange={(v) => setNewBody({ ...newBody, meeting_cadence: v })}
              />
              <Field
                label="Default location"
                value={newBody.default_location}
                onChange={(v) => setNewBody({ ...newBody, default_location: v })}
              />
            </div>
            <div className="mt-4 flex gap-3">
              <button
                className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                disabled={!newBody.name || addBody.isPending}
                onClick={() => addBody.mutate()}
              >
                Add body
              </button>
              <button
                className="rounded-sm border border-border px-4 py-2 text-sm"
                onClick={() => setStep(3)}
              >
                Continue
              </button>
            </div>
          </Panel>
        )}

        {step === 3 && (
          <Panel title="Go live" hint="Final checks before the public portal is announced.">
            <ul className="space-y-2 text-sm">
              <Check ok={!!form.municipality_name}>Municipality name set</Check>
              <Check ok={!!form.contact_email}>Clerk contact email published</Check>
              <Check ok={(bodies.data?.length ?? 0) > 0}>At least one governing body</Check>
              <Check ok={form.notice_days > 0}>Notice period configured</Check>
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              Next: invite staff under Administration → Staff &amp; roles, seat your board members,
              then build your first agenda.
            </p>
            <button
              className="mt-4 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => finish.mutate()}
              disabled={finish.isPending}
            >
              Mark setup complete
            </button>
            {settings.data?.setup_completed_at && (
              <p className="mt-2 text-xs text-muted-foreground">
                Completed {new Date(settings.data.setup_completed_at).toLocaleString()}
              </p>
            )}
          </Panel>
        )}
      </div>
    </StaffShell>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-primary" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={ok ? "" : "text-muted-foreground"}>{children}</span>
    </li>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-sm border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <h2 className="font-display text-base">{title}</h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function SaveRow({
  onSave,
  onNext,
  pending,
}: {
  onSave: () => void;
  onNext: () => void;
  pending: boolean;
}) {
  return (
    <div className="mt-5 flex gap-3">
      <button
        className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        onClick={onSave}
        disabled={pending}
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button className="rounded-sm border border-border px-4 py-2 text-sm" onClick={onNext}>
        Continue
      </button>
    </div>
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
    <label className="block text-sm">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <input
        type={type}
        className="w-full rounded-sm border border-input bg-background px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
