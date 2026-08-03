import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { NOTICE_LABELS, type NoticeKind } from "@/lib/notices";

export const Route = createFileRoute("/_authenticated/staff/notifications")({
  head: () => ({
    meta: [
      { title: "Notification Log — CivicLedger Staff" },
      {
        name: "description",
        content:
          "Every agenda, amendment, minutes and records notice the system sent, with recipient and timestamp.",
      },
      { property: "og:title", content: "Notification Log" },
      {
        property: "og:description",
        content: "Proof of notice for every message the system sent.",
      },
    ],
  }),
  component: Notifications,
});

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-primary/10 text-primary",
  pending_email_setup: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  failed: "bg-destructive/10 text-destructive",
};

function Notifications() {
  const log = useQuery({
    queryKey: ["notification-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_log")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = log.data ?? [];
  const pending = rows.filter((r) => r.status === "pending_email_setup").length;

  return (
    <StaffShell>
      <StaffHeader
        eyebrow="Compliance"
        title="Notification log"
        description="A permanent record of every notice the system generated — who it went to, what it said, and when."
      />
      <div className="space-y-5 p-6">
        {pending > 0 && (
          <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <p className="font-medium">{pending} notices are waiting on email setup.</p>
            <p className="mt-1 text-muted-foreground">
              Connect a sender domain for this city and these queued notices can be released. Until
              then the log still records exactly what was generated.
            </p>
          </div>
        )}

        <div className="overflow-x-auto rounded-sm border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Sent</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Recipient</th>
                <th className="px-4 py-2.5">Subject</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                    {new Date(row.sent_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    {NOTICE_LABELS[row.kind as NoticeKind] ?? row.kind}
                  </td>
                  <td className="px-4 py-2.5">{row.recipient}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.subject}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-sm px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLE[row.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {row.status.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                    {log.isLoading ? "Loading…" : "No notices have been generated yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </StaffShell>
  );
}
