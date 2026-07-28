import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";

export const Route = createFileRoute("/_authenticated/staff/admin")({
  head: () => ({
    meta: [
      { title: "Administration — CivicLedger Staff" },
      { name: "description", content: "Configure bodies, item types, numbering and vote rules." },
      { property: "og:title", content: "Administration" },
      { property: "og:description", content: "Configure the rules that govern the legislative process." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const config = useQuery({
    queryKey: ["admin", "config"],
    queryFn: async () => {
      const [bodies, types, rules, numbering] = await Promise.all([
        supabase.from("bodies").select("id,name,seat_count,quorum_type").order("sort_order"),
        supabase.from("item_types").select("id,name,readings_required").order("sort_order"),
        supabase.from("vote_rules").select("id,name,fraction,basis").order("name"),
        supabase.from("numbering_rules").select("id,pattern,current_seq,reset"),
      ]);
      return {
        bodies: bodies.data ?? [],
        types: types.data ?? [],
        rules: rules.data ?? [],
        numbering: numbering.data ?? [],
      };
    },
  });

  return (
    <StaffShell>
      <StaffHeader
        eyebrow="Configuration"
        title="Administration"
        description="Bodies, item types, numbering patterns and vote thresholds that drive the whole system."
      />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <Panel title="Bodies">
          {(config.data?.bodies ?? []).map((b) => (
            <Row key={b.id} label={b.name} value={`${b.seat_count} seats · ${b.quorum_type}`} />
          ))}
        </Panel>
        <Panel title="Item types">
          {(config.data?.types ?? []).map((t) => (
            <Row key={t.id} label={t.name} value={`${t.readings_required} reading(s)`} />
          ))}
        </Panel>
        <Panel title="Vote rules">
          {(config.data?.rules ?? []).map((r) => (
            <Row key={r.id} label={r.name} value={`${Math.round(r.fraction * 100)}% of ${r.basis}`} />
          ))}
        </Panel>
        <Panel title="Numbering">
          {(config.data?.numbering ?? []).map((n) => (
            <Row key={n.id} label={n.pattern} value={`next ${n.current_seq + 1} · resets ${n.reset}`} />
          ))}
        </Panel>
      </div>
    </StaffShell>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-sm border border-border bg-card p-5">
      <h2 className="border-b border-rule pb-2 font-display text-base font-bold">{title}</h2>
      <div className="mt-2 divide-y divide-border">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <span className="text-foreground">{label}</span>
      <span className="docnum text-muted-foreground">{value}</span>
    </div>
  );
}
