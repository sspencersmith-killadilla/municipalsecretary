import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";

export const Route = createFileRoute("/_authenticated/staff/admin")({
  head: () => ({
    meta: [
      { title: "Administration — CivicLedger Staff" },
      { name: "description", content: "Configure bodies, item types, numbering and vote rules." },
      { property: "og:title", content: "Administration" },
      {
        property: "og:description",
        content: "Configure the rules that govern the legislative process.",
      },
    ],
  }),
  component: Admin,
});

const TABS = [
  "Bodies",
  "Board access",
  "Item types",
  "Vote rules",
  "Numbering",
  "Members",
  "Settings",
] as const;
type Tab = (typeof TABS)[number];

function Admin() {
  const [tab, setTab] = useState<Tab>("Bodies");

  return (
    <StaffShell>
      <StaffHeader
        eyebrow="Configuration"
        title="Administration"
        description="Bodies, item types, numbering patterns and vote thresholds that drive the whole system."
      />
      <div className="flex flex-wrap gap-1 border-b border-border bg-card px-6 py-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="p-6">
        {tab === "Bodies" && <BodiesPanel />}
        {tab === "Board access" && <BoardAccessPanel />}
        {tab === "Item types" && <ItemTypesPanel />}
        {tab === "Vote rules" && <VoteRulesPanel />}
        {tab === "Numbering" && <NumberingPanel />}
        {tab === "Members" && <MembersPanel />}
        {tab === "Settings" && <SettingsPanel />}
      </div>
    </StaffShell>
  );
}

/* ------------------------------------------------------------------ shared */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-sm border border-border bg-card">
      <h2 className="border-b border-rule px-5 py-3 font-display text-base font-bold">{title}</h2>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        {...props}
        className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
      />
    </label>
  );
}

function Select({
  label,
  children,
  ...props
}: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <select
        {...props}
        className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
      >
        {children}
      </select>
    </label>
  );
}

function SaveBar({ onSave, saving }: { onSave: () => void; saving?: boolean }) {
  return (
    <button
      onClick={onSave}
      disabled={saving}
      className="rounded-sm bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
    >
      Save
    </button>
  );
}

function useTable<T>(key: string, load: () => Promise<T[]>) {
  return useQuery({ queryKey: ["admin", key], queryFn: load });
}

function useSaver(keys: string[]) {
  const qc = useQueryClient();
  return (fn: () => Promise<{ error: unknown }>) => async () => {
    const { error } = await fn();
    if (error) {
      toast.error((error as { message?: string }).message ?? "Save failed");
      return;
    }
    toast.success("Saved");
    keys.forEach((k) => qc.invalidateQueries({ queryKey: ["admin", k] }));
  };
}

/* ------------------------------------------------------------------ bodies */

type BodyRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seat_count: number;
  quorum_type: string;
  quorum_value: number | null;
  default_location: string | null;
  meeting_cadence: string | null;
  active: boolean;
  sort_order: number;
};

function BodiesPanel() {
  const q = useTable<BodyRow>("bodies", async () => {
    const { data, error } = await supabase.from("bodies").select("*").order("sort_order");
    if (error) throw error;
    return (data ?? []) as BodyRow[];
  });
  const save = useSaver(["bodies"]);
  const [draft, setDraft] = useState<Record<string, Partial<BodyRow>>>({});
  const [newName, setNewName] = useState("");

  const patch = (id: string, p: Partial<BodyRow>) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...p } }));
  const val = <K extends keyof BodyRow>(b: BodyRow, k: K) => (draft[b.id]?.[k] ?? b[k]) as BodyRow[K];

  return (
    <div className="space-y-6">
      <Card title="Add a body">
        <div className="flex flex-wrap gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Zoning Board of Appeals"
            className="min-w-60 flex-1 rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
          />
          <SaveBar
            onSave={save(async () => {
              if (!newName.trim()) return { error: { message: "Name required" } };
              const slug = newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
              const res = await supabase.from("bodies").insert({
                name: newName.trim(),
                slug,
                seat_count: 7,
                quorum_type: "majority_of_full",
                sort_order: (q.data?.length ?? 0) + 1,
              });
              setNewName("");
              return res;
            })}
          />
        </div>
      </Card>

      {(q.data ?? []).map((b) => (
        <Card key={b.id} title={b.name}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Name"
              value={val(b, "name")}
              onChange={(e) => patch(b.id, { name: e.target.value })}
            />
            <Field
              label="Seats"
              type="number"
              value={val(b, "seat_count")}
              onChange={(e) => patch(b.id, { seat_count: Number(e.target.value) })}
            />
            <Select
              label="Quorum rule"
              value={val(b, "quorum_type")}
              onChange={(e) => patch(b.id, { quorum_type: e.target.value })}
            >
              <option value="majority_of_full">Majority of full membership</option>
              <option value="two_thirds_of_full">Two-thirds of full membership</option>
              <option value="fixed">Fixed number</option>
            </Select>
            <Field
              label="Fixed quorum value"
              type="number"
              value={val(b, "quorum_value") ?? ""}
              onChange={(e) =>
                patch(b.id, { quorum_value: e.target.value ? Number(e.target.value) : null })
              }
            />
            <Field
              label="Default location"
              value={val(b, "default_location") ?? ""}
              onChange={(e) => patch(b.id, { default_location: e.target.value })}
            />
            <Field
              label="Meeting cadence"
              value={val(b, "meeting_cadence") ?? ""}
              onChange={(e) => patch(b.id, { meeting_cadence: e.target.value })}
            />
          </div>
          <div className="mt-4 flex items-center gap-4">
            <SaveBar
              onSave={save(async () =>
                supabase
                  .from("bodies")
                  .update((draft[b.id] ?? {}) as never)
                  .eq("id", b.id),
              )}
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={val(b, "active")}
                onChange={(e) => patch(b.id, { active: e.target.checked })}
              />
              Active
            </label>
          </div>
          <BodySeats bodyId={b.id} />
        </Card>
      ))}
    </div>
  );
}

function BodySeats({ bodyId }: { bodyId: string }) {
  const qc = useQueryClient();
  const seats = useQuery({
    queryKey: ["admin", "seats", bodyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("body_seats")
        .select("id,seat_label,title,member_id,sort_order")
        .eq("body_id", bodyId)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });
  const members = useQuery({
    queryKey: ["admin", "members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id,full_name")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "seats", bodyId] });

  const assign = useMutation({
    mutationFn: async ({ seatId, memberId }: { seatId: string; memberId: string | null }) => {
      const { error } = await supabase
        .from("body_seats")
        .update({ member_id: memberId })
        .eq("id", seatId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Seat updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addSeat = useMutation({
    mutationFn: async () => {
      const n = (seats.data?.length ?? 0) + 1;
      const { error } = await supabase.from("body_seats").insert({
        body_id: bodyId,
        seat_label: `Seat ${n}`,
        sort_order: n,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-5 border-t border-rule pt-4">
      <div className="flex items-center justify-between">
        <h3 className="eyebrow">Seats</h3>
        <button
          onClick={() => addSeat.mutate()}
          className="rounded-sm border border-input px-2 py-1 text-xs font-semibold"
        >
          Add seat
        </button>
      </div>
      <ul className="mt-2 divide-y divide-border">
        {(seats.data ?? []).map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
            <span className="docnum w-28 text-xs text-muted-foreground">
              {s.title ?? s.seat_label}
            </span>
            <select
              value={s.member_id ?? ""}
              onChange={(e) => assign.mutate({ seatId: s.id, memberId: e.target.value || null })}
              className="min-w-48 flex-1 rounded-sm border border-input bg-background px-2.5 py-1.5 text-sm"
            >
              <option value="">— vacant —</option>
              {(members.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </li>
        ))}
        {(seats.data ?? []).length === 0 && (
          <li className="py-3 text-sm text-muted-foreground">No seats defined.</li>
        )}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------- item types */

type TypeRow = {
  id: string;
  name: string;
  slug: string;
  readings_required: number;
  requires_public_hearing: boolean;
  default_vote_rule_id: string | null;
  active: boolean;
};

function ItemTypesPanel() {
  const q = useTable<TypeRow>("types", async () => {
    const { data, error } = await supabase.from("item_types").select("*").order("sort_order");
    if (error) throw error;
    return (data ?? []) as TypeRow[];
  });
  const rules = useTable<{ id: string; name: string }>("rules-lite", async () => {
    const { data, error } = await supabase.from("vote_rules").select("id,name").order("name");
    if (error) throw error;
    return data ?? [];
  });
  const save = useSaver(["types"]);
  const [draft, setDraft] = useState<Record<string, Partial<TypeRow>>>({});
  const [newName, setNewName] = useState("");
  const patch = (id: string, p: Partial<TypeRow>) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...p } }));
  const val = <K extends keyof TypeRow>(t: TypeRow, k: K) => (draft[t.id]?.[k] ?? t[k]) as TypeRow[K];

  return (
    <div className="space-y-6">
      <Card title="Add an item type">
        <div className="flex flex-wrap gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Proclamation"
            className="min-w-60 flex-1 rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
          />
          <SaveBar
            onSave={save(async () => {
              if (!newName.trim()) return { error: { message: "Name required" } };
              const res = await supabase.from("item_types").insert({
                name: newName.trim(),
                slug: newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                sort_order: (q.data?.length ?? 0) + 1,
              });
              setNewName("");
              return res;
            })}
          />
        </div>
      </Card>

      {(q.data ?? []).map((t) => (
        <Card key={t.id} title={t.name}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Name"
              value={val(t, "name")}
              onChange={(e) => patch(t.id, { name: e.target.value })}
            />
            <Field
              label="Readings required"
              type="number"
              value={val(t, "readings_required")}
              onChange={(e) => patch(t.id, { readings_required: Number(e.target.value) })}
            />
            <Select
              label="Default vote rule"
              value={val(t, "default_vote_rule_id") ?? ""}
              onChange={(e) => patch(t.id, { default_vote_rule_id: e.target.value || null })}
            >
              <option value="">— none —</option>
              {(rules.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <SaveBar
              onSave={save(async () =>
                supabase
                  .from("item_types")
                  .update((draft[t.id] ?? {}) as never)
                  .eq("id", t.id),
              )}
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={val(t, "requires_public_hearing")}
                onChange={(e) => patch(t.id, { requires_public_hearing: e.target.checked })}
              />
              Requires public hearing
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={val(t, "active")}
                onChange={(e) => patch(t.id, { active: e.target.checked })}
              />
              Active
            </label>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- vote rules */

type RuleRow = {
  id: string;
  name: string;
  description: string | null;
  fraction: number;
  basis: string;
  abstain_counts_as: string;
  recusal_reduces_base: boolean;
};

function VoteRulesPanel() {
  const q = useTable<RuleRow>("rules", async () => {
    const { data, error } = await supabase.from("vote_rules").select("*").order("name");
    if (error) throw error;
    return (data ?? []) as RuleRow[];
  });
  const save = useSaver(["rules", "rules-lite"]);
  const [draft, setDraft] = useState<Record<string, Partial<RuleRow>>>({});
  const [newName, setNewName] = useState("");
  const patch = (id: string, p: Partial<RuleRow>) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...p } }));
  const val = <K extends keyof RuleRow>(r: RuleRow, k: K) => (draft[r.id]?.[k] ?? r[k]) as RuleRow[K];

  return (
    <div className="space-y-6">
      <Card title="Add a vote rule">
        <div className="flex flex-wrap gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Supermajority (3/4)"
            className="min-w-60 flex-1 rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
          />
          <SaveBar
            onSave={save(async () => {
              if (!newName.trim()) return { error: { message: "Name required" } };
              const res = await supabase
                .from("vote_rules")
                .insert({ name: newName.trim(), fraction: 0.5, basis: "present" });
              setNewName("");
              return res;
            })}
          />
        </div>
      </Card>

      {(q.data ?? []).map((r) => (
        <Card key={r.id} title={r.name}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Name"
              value={val(r, "name")}
              onChange={(e) => patch(r.id, { name: e.target.value })}
            />
            <Field
              label="Fraction required (0–1)"
              type="number"
              step="0.01"
              value={val(r, "fraction")}
              onChange={(e) => patch(r.id, { fraction: Number(e.target.value) })}
            />
            <Select
              label="Basis"
              value={val(r, "basis")}
              onChange={(e) => patch(r.id, { basis: e.target.value })}
            >
              <option value="present">Members present and voting</option>
              <option value="full_membership">Full membership</option>
              <option value="quorum">Quorum present</option>
            </Select>
            <Select
              label="Abstentions count as"
              value={val(r, "abstain_counts_as")}
              onChange={(e) => patch(r.id, { abstain_counts_as: e.target.value })}
            >
              <option value="not_counted">Not counted</option>
              <option value="aye">Aye</option>
              <option value="nay">Nay</option>
            </Select>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <SaveBar
              onSave={save(async () =>
                supabase
                  .from("vote_rules")
                  .update((draft[r.id] ?? {}) as never)
                  .eq("id", r.id),
              )}
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={val(r, "recusal_reduces_base")}
                onChange={(e) => patch(r.id, { recusal_reduces_base: e.target.checked })}
              />
              Recusal reduces the base
            </label>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- numbering */

type NumRow = {
  id: string;
  item_type_id: string;
  body_id: string | null;
  pattern: string;
  current_seq: number;
  reset: string;
};

function NumberingPanel() {
  const q = useTable<NumRow>("numbering", async () => {
    const { data, error } = await supabase.from("numbering_rules").select("*");
    if (error) throw error;
    return (data ?? []) as NumRow[];
  });
  const types = useTable<{ id: string; name: string }>("types-lite", async () => {
    const { data, error } = await supabase.from("item_types").select("id,name").order("sort_order");
    if (error) throw error;
    return data ?? [];
  });
  const save = useSaver(["numbering"]);
  const [draft, setDraft] = useState<Record<string, Partial<NumRow>>>({});
  const [newType, setNewType] = useState("");
  const patch = (id: string, p: Partial<NumRow>) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...p } }));
  const val = <K extends keyof NumRow>(n: NumRow, k: K) => (draft[n.id]?.[k] ?? n[k]) as NumRow[K];
  const typeName = (id: string) => types.data?.find((t) => t.id === id)?.name ?? "Item type";

  return (
    <div className="space-y-6">
      <Card title="Add a numbering rule">
        <p className="mb-3 text-sm text-muted-foreground">
          Patterns support <code className="docnum">{"{YYYY}"}</code>,{" "}
          <code className="docnum">{"{YY}"}</code>, <code className="docnum">{"{seq}"}</code> and{" "}
          <code className="docnum">{"{seq:000}"}</code> for zero padding.
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="min-w-60 flex-1 rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
          >
            <option value="">Select item type…</option>
            {(types.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <SaveBar
            onSave={save(async () => {
              if (!newType) return { error: { message: "Pick an item type" } };
              const res = await supabase.from("numbering_rules").insert({
                item_type_id: newType,
                pattern: "{YYYY}-{seq:000}",
                current_seq: 0,
              });
              setNewType("");
              return res;
            })}
          />
        </div>
      </Card>

      {(q.data ?? []).map((n) => (
        <Card key={n.id} title={typeName(n.item_type_id)}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Pattern"
              value={val(n, "pattern")}
              onChange={(e) => patch(n.id, { pattern: e.target.value })}
            />
            <Field
              label="Current sequence"
              type="number"
              value={val(n, "current_seq")}
              onChange={(e) => patch(n.id, { current_seq: Number(e.target.value) })}
            />
            <Select
              label="Reset"
              value={val(n, "reset")}
              onChange={(e) => patch(n.id, { reset: e.target.value })}
            >
              <option value="annual">Annually</option>
              <option value="never">Never</option>
            </Select>
            <div className="self-end text-sm text-muted-foreground">
              Next:{" "}
              <span className="docnum text-foreground">
                {preview(val(n, "pattern"), val(n, "current_seq") + 1)}
              </span>
            </div>
          </div>
          <div className="mt-4">
            <SaveBar
              onSave={save(async () =>
                supabase
                  .from("numbering_rules")
                  .update((draft[n.id] ?? {}) as never)
                  .eq("id", n.id),
              )}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}

function preview(pattern: string, seq: number) {
  const now = new Date();
  let out = pattern
    .replace("{YYYY}", String(now.getFullYear()))
    .replace("{YY}", String(now.getFullYear()).slice(2));
  const m = out.match(/\{seq:(0+)\}/);
  if (m) out = out.replace(m[0], String(seq).padStart(m[1].length, "0"));
  else out = out.replace("{seq}", String(seq));
  return out;
}

/* ----------------------------------------------------------------- members */

function MembersPanel() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id,full_name,email,active")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("members")
        .insert({ full_name: name.trim(), email: email.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setEmail("");
      toast.success("Member added");
      qc.invalidateQueries({ queryKey: ["admin", "members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("members").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "members"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card title="Add a member">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            add.mutate();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="min-w-48 flex-1 rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            className="min-w-48 flex-1 rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-sm bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Add
          </button>
        </form>
      </Card>
      <Card title="Members">
        <ul className="divide-y divide-border">
          {(q.data ?? []).map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-foreground">{m.full_name}</span>
                <span className="docnum text-xs text-muted-foreground">{m.email ?? "—"}</span>
              </span>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={m.active}
                  onChange={(e) => toggle.mutate({ id: m.id, active: e.target.checked })}
                />
                Active
              </label>
            </li>
          ))}
          {(q.data ?? []).length === 0 && (
            <li className="py-4 text-sm text-muted-foreground">No members yet.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- settings */

type SettingsRow = {
  id: number;
  municipality_name: string;
  tagline: string | null;
  notice_days: number;
  posting_deadline_hours: number;
  public_comment_enabled: boolean;
  contact_email: string | null;
};

function SettingsPanel() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data as SettingsRow | null;
    },
  });
  const [draft, setDraft] = useState<Partial<SettingsRow>>({});
  const s = q.data;
  const val = <K extends keyof SettingsRow>(k: K) =>
    (draft[k] ?? s?.[k]) as SettingsRow[K] | undefined;

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("settings")
        .update(draft as never)
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!s) return <p className="text-sm text-muted-foreground">Loading settings…</p>;

  return (
    <Card title="Municipality settings">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field
          label="Municipality name"
          value={val("municipality_name") ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, municipality_name: e.target.value }))}
        />
        <Field
          label="Tagline"
          value={val("tagline") ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))}
        />
        <Field
          label="Clerk contact email"
          value={val("contact_email") ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, contact_email: e.target.value }))}
        />
        <Field
          label="Public notice days"
          type="number"
          value={val("notice_days") ?? 0}
          onChange={(e) => setDraft((d) => ({ ...d, notice_days: Number(e.target.value) }))}
        />
        <Field
          label="Agenda posting deadline (hours)"
          type="number"
          value={val("posting_deadline_hours") ?? 0}
          onChange={(e) =>
            setDraft((d) => ({ ...d, posting_deadline_hours: Number(e.target.value) }))
          }
        />
      </div>
      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={() => save.mutate()}
          className="rounded-sm bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Save
        </button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={!!val("public_comment_enabled")}
            onChange={(e) =>
              setDraft((d) => ({ ...d, public_comment_enabled: e.target.checked }))
            }
          />
          Public comment enabled
        </label>
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------- board access */

function BoardAccessPanel() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [bodyId, setBodyId] = useState("");
  const [note, setNote] = useState("");

  const bodies = useQuery({
    queryKey: ["admin", "bodies-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bodies").select("id,name").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const people = useQuery({
    queryKey: ["admin", "profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,email,department")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const grants = useQuery({
    queryKey: ["admin", "body-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("body_permissions")
        .select("id,user_id,body_id,can_submit,note")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const grant = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("body_permissions")
        .upsert(
          { user_id: userId, body_id: bodyId, can_submit: true, note: note.trim() || null },
          { onConflict: "user_id,body_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      setNote("");
      toast.success("Board access granted");
      qc.invalidateQueries({ queryKey: ["admin", "body-permissions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("body_permissions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Access revoked");
      qc.invalidateQueries({ queryKey: ["admin", "body-permissions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const personName = (id: string) => {
    const p = (people.data ?? []).find((x) => x.id === id);
    return p ? (p.full_name ?? p.email ?? id) : id;
  };
  const bodyName = (id: string) => (bodies.data ?? []).find((b) => b.id === id)?.name ?? id;

  const byBody = (bodies.data ?? []).map((b) => ({
    body: b,
    rows: (grants.data ?? []).filter((g) => g.body_id === b.id),
  }));

  return (
    <div className="space-y-6">
      <Card title="Grant submission rights">
        <p className="mb-4 text-sm text-muted-foreground">
          Staff may hold submission rights on any number of boards. Administrators and clerks can
          always submit to every board.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!userId || !bodyId) return;
            grant.mutate();
          }}
        >
          <Select label="Staff member" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Select…</option>
            {(people.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name ?? p.email}
              </option>
            ))}
          </Select>
          <Select label="Board" value={bodyId} onChange={(e) => setBodyId(e.target.value)}>
            <option value="">Select…</option>
            {(bodies.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Field
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Public Works liaison"
          />
          <div className="flex items-end">
            <button
              type="submit"
              disabled={grant.isPending}
              className="rounded-sm bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Grant access
            </button>
          </div>
        </form>
      </Card>

      {byBody.map(({ body, rows }) => (
        <Card key={body.id} title={body.name}>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No individual grants. Only administrators and clerks may submit to {body.name}.
            </p>
          ) : (
            <ul className="divide-y divide-rule">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="font-medium">{personName(r.user_id)}</span>
                  {r.note ? (
                    <span className="text-xs text-muted-foreground">{r.note}</span>
                  ) : null}
                  <span className="ml-auto text-xs uppercase tracking-wide text-muted-foreground">
                    {bodyName(r.body_id)}
                  </span>
                  <button
                    onClick={() => revoke.mutate(r.id)}
                    className="rounded-sm border border-border px-2.5 py-1 text-xs text-seal"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}

