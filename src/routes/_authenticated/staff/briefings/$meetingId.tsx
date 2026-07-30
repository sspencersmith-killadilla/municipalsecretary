import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { StatusPill } from "@/components/PublicLayout";
import { formatDateTime, MEETING_STATUS_LABELS, statusTone } from "@/lib/format";
import { generateMeetingBriefings } from "@/lib/briefings.functions";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/staff/briefings/$meetingId")({
  head: () => ({
    meta: [
      { title: "Agenda Briefing — CivicLedger Staff" },
      {
        name: "description",
        content:
          "Plain-language breakdown of every agenda item with department, category and disclosed financial impact.",
      },
      { property: "og:title", content: "Agenda Briefing" },
      {
        property: "og:description",
        content: "Plain-language agenda breakdown with departments and financial impact.",
      },
    ],
  }),
  component: BriefingDashboard,
});

const CATEGORY_LABELS: Record<string, string> = {
  ordinance: "Ordinance",
  resolution: "Resolution",
  grant: "Grant",
  public_hearing: "Public Hearing",
  contract: "Contract",
  appointment: "Appointment",
  other: "Other",
};

const CHART_COLORS = [
  "var(--color-seal)",
  "var(--color-brass)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-primary)",
];

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

type Briefing = {
  agenda_item_id: string;
  plain_summary: string;
  why_it_matters: string | null;
  department: string | null;
  category: string;
  cost_disclosed: boolean;
  cost_amount: number | null;
  is_grant: boolean;
  grant_award_amount: number | null;
  local_match_amount: number | null;
  considerations: string[];
};

type AgendaRow = {
  id: string;
  title: string;
  display_number: string | null;
  section_name: string;
  legislative_items: { assigned_number: string | null; file_number: string | null } | null;
};

function BriefingDashboard() {
  const { meetingId } = Route.useParams();
  const qc = useQueryClient();
  const [dept, setDept] = useState("all");
  const [cat, setCat] = useState("all");
  const [grantsOnly, setGrantsOnly] = useState(false);

  const meeting = useQuery({
    queryKey: ["staff", "meeting", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id,title,starts_at,location,status,bodies(name)")
        .eq("id", meetingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const agenda = useQuery({
    queryKey: ["staff", "briefing-agenda", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_items")
        .select(
          "id,title,display_number,section_name,section_order,position,legislative_items(assigned_number,file_number)",
        )
        .eq("meeting_id", meetingId)
        .order("section_order")
        .order("position");
      if (error) throw error;
      return (data ?? []) as unknown as AgendaRow[];
    },
  });

  const briefings = useQuery({
    queryKey: ["staff", "briefings", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_item_briefings")
        .select(
          "agenda_item_id,plain_summary,why_it_matters,department,category,cost_disclosed,cost_amount,is_grant,grant_award_amount,local_match_amount,considerations",
        )
        .eq("meeting_id", meetingId);
      if (error) throw error;
      return (data ?? []) as Briefing[];
    },
  });

  const generate = useServerFn(generateMeetingBriefings);
  const run = useMutation({
    mutationFn: (onlyMissing: boolean) => generate({ data: { meetingId, onlyMissing } }),
    onSuccess: (res) => {
      toast.success(
        res.generated === 0 ? "Every item already has a briefing" : `Briefed ${res.generated} items`,
      );
      qc.invalidateQueries({ queryKey: ["staff", "briefings", meetingId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const byItem = new Map((briefings.data ?? []).map((b) => [b.agenda_item_id, b]));
  const rows = (agenda.data ?? []).map((a) => ({ agenda: a, brief: byItem.get(a.id) }));

  const briefed = rows.filter((r) => r.brief);
  const stats = useMemo(() => {
    const list = briefed.map((r) => r.brief!);
    const nonGrant = list.filter((b) => !b.is_grant);
    const disclosed = nonGrant.filter((b) => b.cost_disclosed && b.cost_amount !== null);
    const grants = list.filter((b) => b.is_grant);
    const awards = grants.reduce((s, b) => s + (b.grant_award_amount ?? 0), 0);
    const match = grants.reduce((s, b) => s + (b.local_match_amount ?? 0), 0);
    return {
      total: rows.length,
      disclosedCount: disclosed.length,
      nonGrantCount: nonGrant.length,
      disclosedTotal: disclosed.length ? disclosed.reduce((s, b) => s + (b.cost_amount ?? 0), 0) : null,
      departments: new Set(list.map((b) => b.department || "Unassigned")).size,
      grantCount: grants.length,
      awards: grants.some((g) => g.grant_award_amount !== null) ? awards : null,
      match,
    };
  }, [briefed, rows.length]);

  const deptData = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of briefed) {
      const key = r.brief!.department || "Unassigned";
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [briefed]);

  const catData = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of briefed) {
      const key = CATEGORY_LABELS[r.brief!.category] ?? "Other";
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [briefed]);

  const filtered = rows.filter(({ brief }) => {
    if (grantsOnly && !brief?.is_grant) return false;
    if (dept !== "all" && (brief?.department || "Unassigned") !== dept) return false;
    if (cat !== "all" && brief?.category !== cat) return false;
    return true;
  });

  return (
    <StaffShell>
      <StaffHeader
        eyebrow={(meeting.data?.bodies as { name?: string } | null)?.name ?? "Meeting"}
        title={`Briefing — ${meeting.data?.title ?? "Agenda"}`}
        description={`${formatDateTime(meeting.data?.starts_at)}${meeting.data?.location ? ` · ${meeting.data.location}` : ""}`}
        actions={
          <>
            {meeting.data ? (
              <StatusPill
                label={MEETING_STATUS_LABELS[meeting.data.status] ?? meeting.data.status}
                tone={statusTone(meeting.data.status)}
              />
            ) : null}
            <button
              onClick={() => run.mutate(true)}
              disabled={run.isPending || rows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-sm bg-seal px-3.5 py-2 text-sm font-semibold text-seal-foreground disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {run.isPending ? "Briefing…" : "Brief missing items"}
            </button>
            <button
              onClick={() => run.mutate(false)}
              disabled={run.isPending || rows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-sm border border-input px-3.5 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" /> Regenerate all
            </button>
            <Link
              to="/staff/meetings/$meetingId"
              params={{ meetingId }}
              className="rounded-sm border border-input px-3.5 py-2 text-sm font-semibold"
            >
              Agenda builder
            </Link>
          </>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total items" value={String(stats.total)} note={`${briefed.length} briefed`} />
          <Stat
            label="With disclosed cost"
            value={`${stats.disclosedCount} of ${stats.nonGrantCount}`}
            note="Non-grant items"
          />
          <Stat
            label="Disclosed cost total"
            value={stats.disclosedTotal === null ? "—" : money(stats.disclosedTotal)}
            note="Excludes grants"
          />
          <Stat
            label="Departments involved"
            value={String(stats.departments)}
            note={`${stats.grantCount} grant item${stats.grantCount === 1 ? "" : "s"}`}
          />
        </div>

        {stats.grantCount > 0 ? (
          <section className="rounded-sm border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-bold">
                Grants — {stats.grantCount} item{stats.grantCount === 1 ? "" : "s"}
              </h2>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={grantsOnly}
                  onChange={(e) => setGrantsOnly(e.target.checked)}
                />
                Show grants only
              </label>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Stat label="Potential income (awards in)" value={money(stats.awards)} />
              <Stat label="Potential city cost (local match)" value={money(stats.match)} />
              <Stat
                label="Net potential to the city"
                value={stats.awards === null ? "—" : money(stats.awards - stats.match)}
              />
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Items by department" data={deptData} />
          <ChartCard title="Items by type" data={catData} />
        </div>

        <section className="rounded-sm border border-border bg-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-rule px-5 py-3">
            <h2 className="font-display text-base font-bold">Agenda items</h2>
            <div className="ml-auto flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="dept-filter">
                Filter by department
              </label>
              <select
                id="dept-filter"
                value={dept}
                onChange={(e) => setDept(e.target.value)}
                className="rounded-sm border border-input bg-background px-2.5 py-1.5 text-sm"
              >
                <option value="all">All departments</option>
                {deptData.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="cat-filter">
                Filter by type
              </label>
              <select
                id="cat-filter"
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                className="rounded-sm border border-input bg-background px-2.5 py-1.5 text-sm"
              >
                <option value="all">All types</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="px-5 py-10 text-sm text-muted-foreground">
              This meeting has no agenda items yet. Build the agenda first, then generate briefings.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map(({ agenda: a, brief }) => (
                <li key={a.id} className="grid gap-3 px-5 py-4 md:grid-cols-[7rem_minmax(0,1fr)_9rem]">
                  <div>
                    <p className="docnum text-sm text-foreground">
                      {a.legislative_items?.assigned_number ??
                        a.legislative_items?.file_number ??
                        a.display_number ??
                        "—"}
                    </p>
                    {brief ? (
                      <span className="mt-1 inline-block rounded-sm border border-border bg-secondary px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                        {CATEGORY_LABELS[brief.category] ?? "Other"}
                      </span>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {brief?.department || a.section_name}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{a.title}</p>
                    {brief ? (
                      <>
                        <p className="mt-1.5 text-sm text-foreground/85">{brief.plain_summary}</p>
                        {brief.why_it_matters ? (
                          <p className="mt-1 text-xs italic text-muted-foreground">
                            Why it matters: {brief.why_it_matters}
                          </p>
                        ) : null}
                        {brief.considerations?.length ? (
                          <ul className="mt-2 flex flex-wrap gap-1.5">
                            {brief.considerations.map((c, i) => (
                              <li
                                key={i}
                                className="rounded-sm border border-brass/40 bg-brass/10 px-2 py-0.5 text-[0.7rem] text-foreground"
                              >
                                {c}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    ) : (
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        No plain-language briefing yet.
                      </p>
                    )}
                  </div>
                  <div className="text-sm md:text-right">
                    {brief?.is_grant ? (
                      <>
                        <p className="font-semibold text-success">
                          {brief.grant_award_amount === null
                            ? "Amount pending"
                            : `${money(brief.grant_award_amount)} in`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Local match {money(brief.local_match_amount)}
                        </p>
                      </>
                    ) : brief?.cost_disclosed ? (
                      <p className="font-semibold text-foreground">{money(brief.cost_amount)}</p>
                    ) : (
                      <p className="text-muted-foreground">
                        {brief ? "Not disclosed" : "—"}
                      </p>
                    )}
                  </div>
                </li>
              ))}
              {filtered.length === 0 ? (
                <li className="px-5 py-10 text-sm text-muted-foreground">
                  No items match these filters.
                </li>
              ) : null}
            </ul>
          )}
        </section>
      </div>
    </StaffShell>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-bold text-foreground">{value}</p>
      {note ? <p className="mt-0.5 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function ChartCard({ title, data }: { title: string; data: { name: string; count: number }[] }) {
  return (
    <section className="rounded-sm border border-border bg-card p-5">
      <h2 className="font-display text-base font-bold">{title}</h2>
      {data.length === 0 ? (
        <p className="py-10 text-sm text-muted-foreground">
          Generate briefings to populate this chart.
        </p>
      ) : (
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={64}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                width={28}
              />
              <Tooltip
                cursor={{ fill: "var(--color-accent)", opacity: 0.4 }}
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 2,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
