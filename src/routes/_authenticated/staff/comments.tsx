import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { formatDateTime } from "@/lib/format";
import { listCommentsForModeration } from "@/lib/staff-pii.functions";

export const Route = createFileRoute("/_authenticated/staff/comments")({
  head: () => ({
    meta: [
      { title: "Public Comment Moderation — CivicLedger Staff" },
      {
        name: "description",
        content: "Review, approve or reject public comment cards submitted for upcoming meetings.",
      },
      { property: "og:title", content: "Public Comment Moderation" },
      { property: "og:description", content: "Review comment cards submitted by residents." },
    ],
  }),
  component: CommentModeration,
});

type Status = "pending" | "approved" | "rejected";

function CommentModeration() {
  const qc = useQueryClient();
  const fetchComments = useServerFn(listCommentsForModeration);
  const [status, setStatus] = useState<Status>("pending");

  const comments = useQuery({
    queryKey: ["staff", "comments", status],
    queryFn: async () => {
      return await fetchComments({ data: { status } });
    },
  });

  const moderate = useMutation({
    mutationFn: async (input: { id: string; next: Status; queueIt?: boolean }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("public_comments")
        .update({
          status: input.next,
          moderated_by: auth.user?.id ?? null,
          moderated_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comment updated");
      qc.invalidateQueries({ queryKey: ["staff", "comments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addToQueue = useMutation({
    mutationFn: async (c: {
      id: string;
      meeting_id: string;
      agenda_item_id: string | null;
      full_name: string;
      organization: string | null;
    }) => {
      const { data: existing } = await supabase
        .from("speaker_queue")
        .select("id")
        .eq("meeting_id", c.meeting_id);
      const { error } = await supabase.from("speaker_queue").insert({
        meeting_id: c.meeting_id,
        agenda_item_id: c.agenda_item_id,
        comment_id: c.id,
        speaker_name: c.full_name,
        affiliation: c.organization,
        position: (existing?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Added to the speaker queue"),
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = comments.data ?? [];

  return (
    <StaffShell>
      <StaffHeader
        eyebrow="Public participation"
        title="Comment moderation"
        description="Comment cards submitted through the public portal. Approved cards are published on the meeting page and become part of the record."
        actions={
          <div className="flex gap-1" role="group" aria-label="Filter by status">
            {(["pending", "approved", "rejected"] as Status[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                aria-pressed={status === s}
                className={`rounded-sm border px-3 py-1.5 text-xs font-semibold capitalize ${
                  status === s ? "border-seal bg-seal text-seal-foreground" : "border-input"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        }
      />

      <div className="space-y-4 p-6">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No {status} comment cards.</p>
        ) : null}
        {rows.map((c) => {
          const meeting = c.meetings as { id: string; title: string; starts_at: string } | null;
          const item = c.agenda_items as { title: string; display_number: string | null } | null;
          return (
            <article key={c.id} className="rounded-sm border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {c.full_name}
                    {c.organization ? ` — ${c.organization}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(c.created_at)} ·{" "}
                    {meeting ? (
                      <Link
                        to="/staff/meetings/$meetingId"
                        params={{ meetingId: meeting.id }}
                        className="text-seal underline"
                      >
                        {meeting.title}
                      </Link>
                    ) : (
                      "Meeting"
                    )}{" "}
                    ·{" "}
                    {item
                      ? `${item.display_number ? `${item.display_number}. ` : ""}${item.title}`
                      : "General comment"}
                  </p>
                  <p className="docnum mt-1 text-xs uppercase text-muted-foreground">
                    {c.position} · {c.comment_type === "speak" ? "wishes to speak" : "written"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {c.comment_type === "speak" && c.status !== "rejected" ? (
                    <button
                      onClick={() =>
                        addToQueue.mutate({
                          id: c.id,
                          meeting_id: c.meeting_id,
                          agenda_item_id: c.agenda_item_id,
                          full_name: c.full_name,
                          organization: c.organization,
                        })
                      }
                      className="rounded-sm border border-input px-3 py-1.5 text-xs font-semibold"
                    >
                      Add to speaker queue
                    </button>
                  ) : null}
                  {c.status !== "approved" ? (
                    <button
                      onClick={() => moderate.mutate({ id: c.id, next: "approved" })}
                      className="inline-flex items-center gap-1 rounded-sm bg-seal px-3 py-1.5 text-xs font-semibold text-seal-foreground"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" /> Approve
                    </button>
                  ) : null}
                  {c.status !== "rejected" ? (
                    <button
                      onClick={() => moderate.mutate({ id: c.id, next: "rejected" })}
                      className="inline-flex items-center gap-1 rounded-sm border border-destructive/60 px-3 py-1.5 text-xs font-semibold text-destructive"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" /> Reject
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{c.body}</p>
            </article>
          );
        })}
      </div>
    </StaffShell>
  );
}
