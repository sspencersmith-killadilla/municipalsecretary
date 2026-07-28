import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/staff/approvals")({
  head: () => ({
    meta: [
      { title: "My Approvals — CivicLedger Staff" },
      { name: "description", content: "Review and approve legislative files routed to your role." },
      { property: "og:title", content: "My Approvals" },
      { property: "og:description", content: "Approve or reject files routed to you." },
    ],
  }),
  component: Approvals,
});

function Approvals() {
  const { userId, roles } = useSession();
  const queryClient = useQueryClient();

  const q = useQuery({
    queryKey: ["staff", "approvals", userId, roles],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_step_actions")
        .select("id,step_name,state,step_order,workflow_instances(item_id,legislative_items(id,title,summary))")
        .eq("state", "pending")
        .or(`approver_user_id.eq.${userId},approver_role.in.(${roles.join(",") || "viewer"})`)
        .order("step_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const act = useMutation({
    mutationFn: async ({ id, state }: { id: string; state: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("workflow_step_actions")
        .update({ state, acted_by: userId, acted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recorded");
      queryClient.invalidateQueries({ queryKey: ["staff", "approvals"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <StaffShell>
      <StaffHeader
        eyebrow="Review queue"
        title="My approvals"
        description="Files routed to you or your role, awaiting a decision."
      />
      <div className="p-6">
        <ul className="divide-y divide-border border-t border-rule">
          {(q.data ?? []).map((a) => {
            const li = (a.workflow_instances as { legislative_items: { id: string; title: string; summary: string | null } | null } | null)?.legislative_items;
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">{a.step_name}</p>
                  {li ? (
                    <Link
                      to="/staff/legislation/$itemId"
                      params={{ itemId: li.id }}
                      className="font-display text-base font-bold text-foreground hover:text-seal"
                    >
                      {li.title}
                    </Link>
                  ) : null}
                  {li?.summary ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{li.summary}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => act.mutate({ id: a.id, state: "approved" })}
                    className="rounded-sm bg-seal px-3 py-1.5 text-xs font-semibold text-seal-foreground"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => act.mutate({ id: a.id, state: "rejected" })}
                    className="rounded-sm border border-input px-3 py-1.5 text-xs font-semibold"
                  >
                    Reject
                  </button>
                </div>
              </li>
            );
          })}
          {(q.data ?? []).length === 0 && (
            <li className="py-8 text-sm text-muted-foreground">Nothing awaiting your review.</li>
          )}
        </ul>
      </div>
    </StaffShell>
  );
}
