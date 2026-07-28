import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { StatusPill } from "@/components/PublicLayout";
import { formatDateTime, MEETING_STATUS_LABELS, statusTone } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/staff/meetings/")({
  head: () => ({
    meta: [
      { title: "Meetings & Agendas — CivicLedger Staff" },
      { name: "description", content: "Schedule meetings, assemble agendas and publish packets." },
      { property: "og:title", content: "Meetings & Agendas" },
      { property: "og:description", content: "Schedule meetings and assemble agendas." },
    ],
  }),
  component: StaffMeetings,
});

function StaffMeetings() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [bodyId, setBodyId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");

  const bodies = useQuery({
    queryKey: ["staff", "bodies-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bodies")
        .select("id,name,default_location")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .insert({
          title: title.trim(),
          body_id: bodyId,
          starts_at: new Date(startsAt).toISOString(),
          location: location.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Meeting scheduled");
      qc.invalidateQueries({ queryKey: ["staff", "meetings"] });
      setOpen(false);
      navigate({ to: "/staff/meetings/$meetingId", params: { meetingId: data.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const q = useQuery({
    queryKey: ["staff", "meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id,title,starts_at,location,status,bodies(name)")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <StaffShell>
      <StaffHeader
        eyebrow="Clerk"
        title="Meetings & agendas"
        description="Every scheduled meeting and the state of its agenda."
        actions={
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-sm bg-seal px-3.5 py-2 text-sm font-semibold text-seal-foreground"
          >
            {open ? "Cancel" : "Schedule meeting"}
          </button>
        }
      />
      <div className="p-6">
        {open && (
          <form
            className="mb-6 grid gap-3 rounded-sm border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim() || !bodyId || !startsAt) {
                toast.error("Body, title and date are required");
                return;
              }
              create.mutate();
            }}
          >
            <select
              value={bodyId}
              onChange={(e) => {
                setBodyId(e.target.value);
                const b = bodies.data?.find((x) => x.id === e.target.value);
                if (b?.default_location && !location) setLocation(b.default_location);
              }}
              className="rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
            >
              <option value="">Select body…</option>
              {(bodies.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meeting title"
              className="rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
            />
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
            />
            <div className="flex gap-2">
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location"
                className="min-w-0 flex-1 rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                Create
              </button>
            </div>
          </form>
        )}
        <ul className="divide-y divide-border border-t border-rule">
          {(q.data ?? []).map((m) => (
            <li key={m.id}>
              <Link
                to="/staff/meetings/$meetingId"
                params={{ meetingId: m.id }}
                className="flex flex-wrap items-center gap-4 py-4 hover:bg-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="docnum text-muted-foreground">
                    {(m.bodies as { name?: string } | null)?.name}
                  </p>
                  <p className="font-display text-base font-bold text-foreground">{m.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(m.starts_at)} · {m.location ?? "Location TBD"}
                  </p>
                </div>
                <StatusPill
                  label={MEETING_STATUS_LABELS[m.status] ?? m.status}
                  tone={statusTone(m.status)}
                />
              </Link>
            </li>
          ))}
          {(q.data ?? []).length === 0 && (
            <li className="py-8 text-sm text-muted-foreground">No meetings yet.</li>
          )}
        </ul>
      </div>
    </StaffShell>
  );
}
