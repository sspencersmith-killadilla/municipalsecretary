import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MEETING_KIND_LABELS, type MeetingKind } from "@/lib/compliance";

type MeetingLike = {
  id: string;
  meeting_kind: MeetingKind;
  emergency_justification: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  comments_open: boolean;
  comment_deadline: string | null;
  speaker_seconds: number;
};

export function MeetingComplianceSettings({ meeting }: { meeting: MeetingLike }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<MeetingKind>(meeting.meeting_kind);
  const [justification, setJustification] = useState(meeting.emergency_justification ?? "");
  const [reason, setReason] = useState(meeting.cancellation_reason ?? "");
  const [seconds, setSeconds] = useState(meeting.speaker_seconds);
  const [commentsOpen, setCommentsOpen] = useState(meeting.comments_open);

  const media = useQuery({
    queryKey: ["staff", "media", meeting.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_media")
        .select("*")
        .eq("meeting_id", meeting.id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [mediaUrl, setMediaUrl] = useState("");
  const [captionsUrl, setCaptionsUrl] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["staff", "meeting", meeting.id] });
    qc.invalidateQueries({ queryKey: ["staff", "media", meeting.id] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("meetings")
        .update({
          meeting_kind: kind,
          emergency_justification: justification || null,
          comments_open: commentsOpen,
          speaker_seconds: seconds,
        })
        .eq("id", meeting.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meeting settings saved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) throw new Error("A public reason is required to cancel a meeting.");
      const { error } = await supabase
        .from("meetings")
        .update({
          status: "cancelled" as never,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: reason.trim(),
        })
        .eq("id", meeting.id);
      if (error) throw error;
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from("audit_log").insert({
        entity_type: "meeting",
        entity_id: meeting.id,
        action: "meeting_cancelled",
        detail: reason.trim(),
        actor_id: auth.user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Meeting cancelled — post a cancellation notice next");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMedia = useMutation({
    mutationFn: async () => {
      if (!mediaUrl.trim()) throw new Error("Enter a recording URL.");
      const { error } = await supabase.from("meeting_media").insert({
        meeting_id: meeting.id,
        url: mediaUrl.trim(),
        captions_url: captionsUrl.trim() || null,
        captions_available: !!captionsUrl.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMediaUrl("");
      setCaptionsUrl("");
      toast.success("Recording linked");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-sm border border-border bg-card">
      <h2 className="flex items-center gap-2 border-b border-rule px-5 py-3 font-display text-base font-bold">
        <CalendarClock className="h-4 w-4" aria-hidden="true" /> Meeting type & participation
      </h2>
      <div className="space-y-4 p-5 text-sm">
        <label className="block text-xs">
          <span className="eyebrow">Meeting type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as MeetingKind)}
            className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
          >
            {Object.entries(MEETING_KIND_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {kind === "emergency" ? (
          <label className="block text-xs">
            <span className="eyebrow">Emergency justification (published)</span>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={commentsOpen}
              onChange={(e) => setCommentsOpen(e.target.checked)}
              className="h-4 w-4"
            />
            Accept online public comment
          </label>
          <label className="block text-xs">
            <span className="eyebrow">Speaker time limit (seconds)</span>
            <input
              type="number"
              min={30}
              max={1800}
              value={seconds}
              onChange={(e) => setSeconds(Number(e.target.value))}
              className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
            />
          </label>
        </div>

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-sm border border-input px-3.5 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Save settings
        </button>

        <div className="border-t border-border pt-4">
          <p className="eyebrow">Recording & captions</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {media.data?.map((m) => (
              <li key={m.id} className="truncate">
                {m.url} {m.captions_available ? "· captioned" : "· NO CAPTIONS"}
              </li>
            ))}
            {(media.data ?? []).length === 0 ? <li>No recording linked.</li> : null}
          </ul>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="Recording URL"
              aria-label="Recording URL"
              className="rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
            />
            <input
              value={captionsUrl}
              onChange={(e) => setCaptionsUrl(e.target.value)}
              placeholder="Captions / transcript URL"
              aria-label="Captions URL"
              className="rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => addMedia.mutate()}
            disabled={addMedia.isPending}
            className="mt-2 rounded-sm border border-input px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            Link recording
          </button>
          <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
            Recordings posted publicly must carry captions or an equivalent transcript to satisfy
            Section 508 / ADA effective-communication requirements.
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <p className="eyebrow text-destructive">Cancel meeting</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Public reason for cancellation"
            aria-label="Cancellation reason"
            className="mt-2 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={() => cancel.mutate()}
            disabled={cancel.isPending || !!meeting.cancelled_at}
            className="mt-2 rounded-sm border border-destructive/60 px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-50"
          >
            {meeting.cancelled_at ? "Meeting cancelled" : "Cancel this meeting"}
          </button>
        </div>
      </div>
    </section>
  );
}
