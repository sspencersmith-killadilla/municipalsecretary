import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Executive (closed) session record. Content is stored in `closed_minutes`,
 * which only staff with management rights may read.
 */
export function ClosedSessionPanel({ meetingId }: { meetingId: string }) {
  const qc = useQueryClient();
  const record = useQuery({
    queryKey: ["staff", "closed-minutes", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("closed_minutes")
        .select("*")
        .eq("meeting_id", meetingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [citation, setCitation] = useState("");
  const [content, setContent] = useState("");
  const [publicAction, setPublicAction] = useState("");
  const loaded = record.data;

  const save = useMutation({
    mutationFn: async () => {
      const cite = (citation || loaded?.citation || "").trim();
      if (!cite) throw new Error("A statutory citation is required for a closed session.");
      const payload = {
        meeting_id: meetingId,
        citation: cite,
        content: content || loaded?.content || "",
        public_action_taken: publicAction || loaded?.public_action_taken || null,
      };
      const { error } = loaded
        ? await supabase.from("closed_minutes").update(payload).eq("id", loaded.id)
        : await supabase.from("closed_minutes").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Closed session record saved");
      qc.invalidateQueries({ queryKey: ["staff", "closed-minutes", meetingId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-sm border border-border bg-card">
      <h2 className="flex items-center gap-2 border-b border-rule px-5 py-3 font-display text-base font-bold">
        <Lock className="h-4 w-4" aria-hidden="true" /> Executive session
      </h2>
      <div className="space-y-3 p-5 text-sm">
        <p className="text-xs text-muted-foreground">
          Sealed minutes are visible only to staff. The public action statement below is published
          on the meeting page so the record shows what was decided after the closed session.
        </p>
        <label className="block text-xs">
          <span className="eyebrow">Statutory citation (required)</span>
          <input
            value={citation || loaded?.citation || ""}
            onChange={(e) => setCitation(e.target.value)}
            placeholder="e.g. Open Meetings Act § 551.071 — consultation with attorney"
            className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="eyebrow">Sealed minutes (staff only)</span>
          <textarea
            value={content || loaded?.content || ""}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="eyebrow">Public action taken after closed session</span>
          <textarea
            value={publicAction || loaded?.public_action_taken || ""}
            onChange={(e) => setPublicAction(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-sm border border-input px-3.5 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Save closed session record
        </button>
      </div>
    </section>
  );
}
