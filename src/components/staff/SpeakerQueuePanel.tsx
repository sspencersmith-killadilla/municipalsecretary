import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mic, Play, SkipForward, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

function mmss(total: number) {
  const s = Math.max(0, Math.floor(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function SpeakerQueuePanel({
  meetingId,
  defaultSeconds,
  onSpoken,
}: {
  meetingId: string;
  defaultSeconds: number;
  onSpoken?: (line: string) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [tick, setTick] = useState(0);

  const queue = useQuery({
    queryKey: ["staff", "speakers", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speaker_queue")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  const rows = queue.data ?? [];
  const speaking = rows.find((r) => r.status === "speaking");

  useEffect(() => {
    if (!speaking) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [speaking?.id]);

  const elapsed =
    speaking?.started_at != null
      ? (Date.now() - new Date(speaking.started_at).getTime()) / 1000 + tick * 0
      : 0;
  const remaining = speaking ? (speaking.seconds_allowed ?? defaultSeconds) - elapsed : 0;

  const refresh = () => qc.invalidateQueries({ queryKey: ["staff", "speakers", meetingId] });

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Enter a speaker name.");
      const { error } = await supabase.from("speaker_queue").insert({
        meeting_id: meetingId,
        speaker_name: name.trim(),
        position: rows.length + 1,
        seconds_allowed: defaultSeconds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const start = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("speaker_queue")
        .update({ status: "done" })
        .eq("meeting_id", meetingId)
        .eq("status", "speaking");
      const { error } = await supabase
        .from("speaker_queue")
        .update({ status: "speaking", started_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const finish = useMutation({
    mutationFn: async (row: { id: string; speaker_name: string; started_at: string | null }) => {
      const used = row.started_at
        ? Math.round((Date.now() - new Date(row.started_at).getTime()) / 1000)
        : null;
      const { error } = await supabase
        .from("speaker_queue")
        .update({ status: "done", seconds_used: used })
        .eq("id", row.id);
      if (error) throw error;
      onSpoken?.(
        `${row.speaker_name} addressed the body${used ? ` for ${mmss(used)}` : ""} during public comment.`,
      );
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("speaker_queue").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  return (
    <section className="rounded-sm border border-border bg-card">
      <h2 className="flex items-center gap-2 border-b border-rule px-5 py-3 font-display text-base font-bold">
        <Mic className="h-4 w-4" aria-hidden="true" /> Speaker queue
      </h2>
      <div className="space-y-3 p-5">
        {speaking ? (
          <div
            className={`rounded-sm border px-3 py-2 text-sm ${
              remaining < 0 ? "border-destructive/60 bg-destructive/10" : "border-border bg-secondary"
            }`}
            role="status"
            aria-live="polite"
          >
            <strong>{speaking.speaker_name}</strong> speaking —{" "}
            <span className="docnum">
              {remaining < 0 ? `over by ${mmss(-remaining)}` : `${mmss(remaining)} remaining`}
            </span>
          </div>
        ) : null}

        <ul className="divide-y divide-border border-y border-border text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="docnum w-6 text-muted-foreground">{r.position}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{r.speaker_name}</span>
                <span className="block text-xs text-muted-foreground">
                  {r.affiliation ?? "Resident"} · {r.status}
                  {r.seconds_used ? ` · spoke ${mmss(r.seconds_used)}` : ""}
                </span>
              </span>
              {r.status === "waiting" ? (
                <button
                  onClick={() => start.mutate(r.id)}
                  aria-label={`Start ${r.speaker_name}`}
                  className="rounded-sm border border-input p-1.5"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
              {r.status === "speaking" ? (
                <button
                  onClick={() => finish.mutate(r)}
                  aria-label={`Finish ${r.speaker_name}`}
                  className="rounded-sm border border-input p-1.5"
                >
                  <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
              <button
                onClick={() => remove.mutate(r.id)}
                aria-label={`Remove ${r.speaker_name}`}
                className="rounded-sm border border-input p-1.5 text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
          {rows.length === 0 ? (
            <li className="py-4 text-sm text-muted-foreground">No speakers queued.</li>
          ) : null}
        </ul>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add speaker from the floor…"
            aria-label="Speaker name"
            className="min-w-0 flex-1 rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-sm border border-input px-3 py-2 text-sm font-semibold"
          >
            Add
          </button>
        </form>
      </div>
    </section>
  );
}
