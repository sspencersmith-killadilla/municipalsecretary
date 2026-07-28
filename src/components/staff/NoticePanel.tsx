import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileDown, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/components/PublicLayout";
import { downloadPostingCertificate } from "@/lib/documents";
import {
  DEFAULT_POSTING_LOCATIONS,
  MEETING_KIND_LABELS,
  NOTICE_KIND_LABELS,
  checkNoticeTiming,
  draftNoticeText,
  type MeetingKind,
  type NoticeKind,
} from "@/lib/compliance";
import { formatDateTime } from "@/lib/format";

type MeetingLike = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
  meeting_kind: MeetingKind;
  emergency_justification: string | null;
  bodies?: { name?: string } | null;
};

export function NoticePanel({
  meeting,
  agenda,
}: {
  meeting: MeetingLike;
  agenda: { display_number: string | null; title: string }[];
}) {
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const [kind, setKind] = useState<NoticeKind>("original");
  const [locations, setLocations] = useState<string[]>(DEFAULT_POSTING_LOCATIONS);
  const [content, setContent] = useState("");

  const notices = useQuery({
    queryKey: ["staff", "notices", meeting.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_notices")
        .select("*")
        .eq("meeting_id", meeting.id)
        .order("posted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const timing = useMemo(
    () => checkNoticeTiming(meeting.starts_at, meeting.meeting_kind, settings ?? null),
    [meeting.starts_at, meeting.meeting_kind, settings],
  );

  const generated = useMemo(
    () =>
      draftNoticeText({
        municipality: settings?.municipality_name ?? "the Municipality",
        bodyName: meeting.bodies?.name ?? "Legislative Body",
        meetingTitle: meeting.title,
        kind: meeting.meeting_kind,
        startsAt: meeting.starts_at,
        location: meeting.location,
        items: agenda,
        emergencyJustification: meeting.emergency_justification,
      }),
    [settings, meeting, agenda],
  );

  const post = useMutation({
    mutationFn: async () => {
      const body = (content.trim() || generated).trim();
      const existing = notices.data ?? [];
      const { data: auth } = await supabase.auth.getUser();
      const { data: profile } = auth.user
        ? await supabase.from("profiles").select("full_name").eq("id", auth.user.id).maybeSingle()
        : { data: null };
      const check = checkNoticeTiming(meeting.starts_at, meeting.meeting_kind, settings ?? null);
      const { error } = await supabase.from("meeting_notices").insert({
        meeting_id: meeting.id,
        kind,
        version: existing.length + 1,
        content: body,
        posting_locations: locations,
        posted_by: auth.user?.id ?? null,
        posted_by_name: profile?.full_name ?? auth.user?.email ?? null,
        deadline_at: check.deadline ? check.deadline.toISOString() : null,
        compliant: check.compliant,
        compliance_note: check.message,
      });
      if (error) throw error;
      await supabase.from("audit_log").insert({
        entity_type: "meeting",
        entity_id: meeting.id,
        action: "notice_posted",
        detail: `${NOTICE_KIND_LABELS[kind]} — ${check.compliant ? "timely" : "late"}`,
        actor_id: auth.user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Notice posted and logged");
      setContent("");
      qc.invalidateQueries({ queryKey: ["staff", "notices", meeting.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const certificate = useMutation({
    mutationFn: () => downloadPostingCertificate(meeting.id),
    onSuccess: (f) => toast.success(`Downloaded ${f}`),
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = notices.data ?? [];

  return (
    <section className="rounded-sm border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-5 py-3">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <Megaphone className="h-4 w-4" aria-hidden="true" /> Public notice
        </h2>
        <button
          onClick={() => certificate.mutate()}
          disabled={certificate.isPending || rows.length === 0}
          className="inline-flex items-center gap-1.5 rounded-sm border border-input px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          <FileDown className="h-3.5 w-3.5" aria-hidden="true" /> Certificate of posting
        </button>
      </div>

      <div className="space-y-4 p-5">
        <div
          className={`flex items-start gap-2 rounded-sm border px-3 py-2 text-xs ${
            timing.compliant
              ? "border-border bg-secondary text-foreground"
              : "border-destructive/50 bg-destructive/10 text-foreground"
          }`}
          role="status"
        >
          {timing.compliant ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>
            <strong>{MEETING_KIND_LABELS[meeting.meeting_kind]}</strong> requires{" "}
            {timing.leadHours} hours of notice. Deadline{" "}
            {timing.deadline ? formatDateTime(timing.deadline.toISOString()) : "unknown"}.{" "}
            {timing.message}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="eyebrow">Notice type</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as NoticeKind)}
              className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
            >
              {Object.entries(NOTICE_KIND_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="eyebrow">Posting locations (comma separated)</span>
            <input
              value={locations.join(", ")}
              onChange={(e) =>
                setLocations(
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
              className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block text-xs">
          <span className="eyebrow">Notice text</span>
          <textarea
            value={content || generated}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => post.mutate()}
            disabled={post.isPending}
            className="rounded-sm bg-seal px-3.5 py-2 text-sm font-semibold text-seal-foreground disabled:opacity-50"
          >
            {rows.length === 0 ? "Post notice" : "Post amended notice"}
          </button>
          <button
            onClick={() => setContent(generated)}
            className="rounded-sm border border-input px-3.5 py-2 text-sm font-semibold"
          >
            Regenerate from agenda
          </button>
        </div>

        <div>
          <p className="eyebrow">Posting history</p>
          {rows.length === 0 ? (
            <p className="pt-2 text-sm text-muted-foreground">
              No notice has been posted for this meeting yet.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border border-t border-border text-sm">
              {rows.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="docnum text-muted-foreground">v{n.version}</span>
                  <span className="font-medium">
                    {NOTICE_KIND_LABELS[n.kind as NoticeKind] ?? n.kind}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(n.posted_at)} · {n.posted_by_name ?? "clerk"}
                  </span>
                  <span
                    className={`ml-auto rounded-sm border px-2 py-0.5 text-[0.68rem] font-semibold uppercase ${
                      n.compliant
                        ? "border-border text-muted-foreground"
                        : "border-destructive/60 text-destructive"
                    }`}
                  >
                    {n.compliant ? "Timely" : "Late"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
