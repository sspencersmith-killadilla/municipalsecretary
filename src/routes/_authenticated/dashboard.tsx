import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { StatusPill } from "@/components/PublicLayout";
import { useSession } from "@/lib/session";
import { formatDateTime, ITEM_STATUS_LABELS, MEETING_STATUS_LABELS, statusTone } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Staff Dashboard — CivicLedger" },
      {
        name: "description",
        content: "Pending approvals, drafts in progress and upcoming meetings for municipal staff.",
      },
      { property: "og:title", content: "Staff Dashboard" },
      { property: "og:description", content: "Your legislative workload at a glance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user, roles, isStaff, userId } = useSession();

  const drafts = useQuery({
    queryKey: ["staff", "drafts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legislative_items")
        .select("id,title,status,file_number,assigned_number,updated_at")
        .in("status", ["draft", "in_review", "approved"])
        .order("updated_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const meetings = useQuery({
    queryKey: ["staff", "meetings-soon"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id,title,starts_at,status,bodies(name)")
        .order("starts_at", { ascending: true })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  const approvals = useQuery({
    queryKey: ["staff", "my-approvals", userId, roles],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_step_actions")
        .select("id,step_name,state,instance_id,workflow_instances(item_id,legislative_items(title))")
        .eq("state", "pending")
        .or(`approver_user_id.eq.${userId},approver_role.in.(${roles.join(",") || "viewer"})`);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <StaffShell>
      <StaffHeader
        eyebrow="Staff workspace"
        title={`Welcome, ${user?.email?.split("@")[0] ?? "colleague"}`}
        description="Everything awaiting your action across drafting, review and meeting preparation."
      />

      {!isStaff && (
        <div className="mx-6 mt-6 rounded-sm border border-warning/50 bg-warning/10 p-4 text-sm">
          Your account has no staff role yet. An administrator must grant you a role before you can
          draft or approve legislation.
        </div>
      )}

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <Card title="Awaiting your approval" to="/staff/approvals" count={approvals.data?.length ?? 0}>
          <ul className="divide-y divide-border">
            {(approvals.data ?? []).slice(0, 5).map((a) => {
              const wi = a.workflow_instances as {
                item_id: string;
                legislative_items: { title: string } | null;
              } | null;
              return (
                <li key={a.id} className="py-2.5">
                  <p className="text-sm font-medium text-foreground">
                    {wi?.legislative_items?.title ?? "Legislative file"}
                  </p>
                  <p className="docnum text-muted-foreground">{a.step_name}</p>
                </li>
              );
            })}
            {(approvals.data ?? []).length === 0 && <Empty>Nothing awaiting you.</Empty>}
          </ul>
        </Card>

        <Card title="Files in progress" to="/staff/legislation" count={drafts.data?.length ?? 0}>
          <ul className="divide-y divide-border">
            {(drafts.data ?? []).map((d) => (
              <li key={d.id}>
                <Link
                  to="/staff/legislation/$itemId"
                  params={{ itemId: d.id }}
                  className="flex items-center gap-2 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{d.title}</span>
                  <StatusPill
                    label={ITEM_STATUS_LABELS[d.status] ?? d.status}
                    tone={statusTone(d.status)}
                  />
                </Link>
              </li>
            ))}
            {(drafts.data ?? []).length === 0 && <Empty>No open drafts.</Empty>}
          </ul>
        </Card>

        <Card title="Meetings" to="/staff/meetings" count={meetings.data?.length ?? 0}>
          <ul className="divide-y divide-border">
            {(meetings.data ?? []).map((m) => (
              <li key={m.id}>
                <Link
                  to="/staff/meetings/$meetingId"
                  params={{ meetingId: m.id }}
                  className="block py-2.5"
                >
                  <p className="text-sm font-medium text-foreground">
                    {(m.bodies as { name?: string } | null)?.name}
                  </p>
                  <p className="docnum text-muted-foreground">{formatDateTime(m.starts_at)}</p>
                  <StatusPill
                    label={MEETING_STATUS_LABELS[m.status] ?? m.status}
                    tone={statusTone(m.status)}
                  />
                </Link>
              </li>
            ))}
            {(meetings.data ?? []).length === 0 && <Empty>No meetings scheduled.</Empty>}
          </ul>
        </Card>
      </div>
    </StaffShell>
  );
}

function Card({
  title,
  to,
  count,
  children,
}: {
  title: string;
  to: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-sm border border-border bg-card p-5">
      <div className="flex items-center justify-between border-b border-rule pb-2">
        <h2 className="font-display text-base font-bold">{title}</h2>
        <span className="docnum text-muted-foreground">{count}</span>
      </div>
      <div className="mt-2">{children}</div>
      <Link to={to} className="mt-3 inline-block text-xs font-medium text-seal hover:underline">
        View all →
      </Link>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <li className="py-3 text-sm text-muted-foreground">{children}</li>;
}
