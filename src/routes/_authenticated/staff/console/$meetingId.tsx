import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { SpeakerQueuePanel } from "@/components/staff/SpeakerQueuePanel";
import { sha256Hex, formatHash } from "@/lib/integrity";
import { formatDateTime } from "@/lib/format";
import { computeTally, quorumRequired, type VoteChoice, type VoteRule } from "@/lib/votes";
import { downloadMinutes } from "@/lib/documents";

export const Route = createFileRoute("/_authenticated/staff/console/$meetingId")({
  head: () => ({
    meta: [
      { title: "Live Meeting Console — CivicLedger Staff" },
      { name: "description", content: "Roll call, motions, electronic voting and live minutes." },
      { property: "og:title", content: "Live Meeting Console" },
      { property: "og:description", content: "Run the meeting and record every vote." },
    ],
  }),
  component: LiveConsole,
});

const CHOICES: VoteChoice[] = ["aye", "nay", "abstain", "recuse", "absent"];
const ATTEND = ["present", "remote", "absent", "excused"] as const;

function LiveConsole() {
  const { meetingId } = Route.useParams();
  const qc = useQueryClient();
  const [motionText, setMotionText] = useState("");
  const [mover, setMover] = useState("");
  const [seconder, setSeconder] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [minutesDraft, setMinutesDraft] = useState("");
  const [minutesLoaded, setMinutesLoaded] = useState(false);

  const meeting = useQuery({
    queryKey: ["console", "meeting", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*, bodies(id,name,seat_count,quorum_type,quorum_value)")
        .eq("id", meetingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const body = meeting.data?.bodies as
    | { id: string; name: string; seat_count: number; quorum_type: string; quorum_value: number | null }
    | null;

  const seats = useQuery({
    queryKey: ["console", "seats", body?.id],
    enabled: !!body?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("body_seats")
        .select("id,seat_label,title,member_id,members(id,full_name)")
        .eq("body_id", body!.id)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const attendance = useQuery({
    queryKey: ["console", "attendance", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("id,member_id,status")
        .eq("meeting_id", meetingId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const agenda = useQuery({
    queryKey: ["console", "agenda", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_items")
        .select("id,title,display_number,section_name,section_order,position,outcome,item_id")
        .eq("meeting_id", meetingId)
        .order("section_order")
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rules = useQuery({
    queryKey: ["console", "vote-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vote_rules").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as VoteRule[];
    },
  });

  const motions = useQuery({
    queryKey: ["console", "motions", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motions")
        .select("*, votes(id,member_id,choice)")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const minutes = useQuery({
    queryKey: ["console", "minutes", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("minutes")
        .select("*")
        .eq("meeting_id", meetingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (minutes.data && !minutesLoaded) {
      setMinutesDraft(minutes.data.content ?? "");
      setMinutesLoaded(true);
    }
  }, [minutes.data, minutesLoaded]);

  const members = (seats.data ?? [])
    .map((s) => ({
      seatLabel: s.seat_label,
      title: s.title,
      member: s.members as { id: string; full_name: string } | null,
    }))
    .filter((s) => s.member);

  const attMap = new Map((attendance.data ?? []).map((a) => [a.member_id, a.status as string]));
  const presentCount = members.filter(
    (m) => ["present", "remote"].includes(attMap.get(m.member!.id) ?? ""),
  ).length;
  const quorum = body ? quorumRequired(body.quorum_type, body.quorum_value, body.seat_count) : 0;
  const hasQuorum = presentCount >= quorum;

  const currentId = meeting.data?.current_agenda_item_id ?? null;
  const currentItem = (agenda.data ?? []).find((a) => a.id === currentId) ?? null;
  const openMotion = (motions.data ?? []).find((m) => m.is_open) ?? null;

  const inv = (key: string) =>
    qc.invalidateQueries({ queryKey: ["console", key, meetingId] });

  const setAttendance = useMutation({
    mutationFn: async ({ memberId, status }: { memberId: string; status: string }) => {
      const { error } = await supabase
        .from("attendance")
        .upsert(
          { meeting_id: meetingId, member_id: memberId, status: status as never },
          { onConflict: "meeting_id,member_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => inv("attendance"),
    onError: (e: Error) => toast.error(e.message),
  });

  const setMeeting = useMutation({
    mutationFn: async (patch: {
      status?: string;
      current_agenda_item_id?: string | null;
    }) => {
      const { error } = await supabase
        .from("meetings")
        .update(patch as never)
        .eq("id", meetingId);
      if (error) throw error;
    },
    onSuccess: () => inv("meeting"),
    onError: (e: Error) => toast.error(e.message),
  });

  const createMotion = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("motions").insert({
        meeting_id: meetingId,
        agenda_item_id: currentId,
        text: motionText.trim(),
        mover_id: mover || null,
        seconder_id: seconder || null,
        vote_rule_id: ruleId || null,
        is_open: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMotionText("");
      setMover("");
      setSeconder("");
      toast.success("Motion on the floor");
      inv("motions");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const castVote = useMutation({
    mutationFn: async ({
      motionId,
      memberId,
      choice,
    }: {
      motionId: string;
      memberId: string;
      choice: VoteChoice;
    }) => {
      const { error } = await supabase
        .from("votes")
        .upsert(
          { motion_id: motionId, member_id: memberId, choice: choice as never },
          { onConflict: "motion_id,member_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => inv("motions"),
    onError: (e: Error) => toast.error(e.message),
  });

  const closeMotion = useMutation({
    mutationFn: async (motion: {
      id: string;
      agenda_item_id: string | null;
      vote_rule_id: string | null;
      votes: { member_id: string; choice: string }[];
    }) => {
      const rule = (rules.data ?? []).find((r) => r.id === motion.vote_rule_id) ?? null;
      const tally = computeTally({
        votes: motion.votes.map((v) => ({ member_id: v.member_id, choice: v.choice as VoteChoice })),
        seatCount: body?.seat_count ?? members.length,
        presentCount,
        rule,
      });
      const result = tally.passed ? "carried" : "failed";
      const { error } = await supabase
        .from("motions")
        .update({ is_open: false, result, tally: tally as never })
        .eq("id", motion.id);
      if (error) throw error;

      if (motion.agenda_item_id) {
        await supabase
          .from("agenda_items")
          .update({ outcome: result })
          .eq("id", motion.agenda_item_id);
        const item = (agenda.data ?? []).find((a) => a.id === motion.agenda_item_id);
        if (item?.item_id) {
          await supabase
            .from("legislative_items")
            .update({
              status: tally.passed ? "adopted" : "failed",
              adopted_at: tally.passed ? new Date().toISOString() : null,
            })
            .eq("id", item.item_id);
        }
      }
      return tally;
    },
    onSuccess: (tally) => {
      toast.success(tally.passed ? "Motion carried" : "Motion failed", {
        description: tally.explanation,
      });
      inv("motions");
      inv("agenda");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMinutes = useMutation({
    mutationFn: async (finalize: boolean) => {
      const now = new Date().toISOString();
      const hash = finalize ? await sha256Hex(minutesDraft) : null;
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("minutes").upsert(
        {
          meeting_id: meetingId,
          content: minutesDraft,
          finalized: finalize,
          finalized_at: finalize ? now : null,
          finalized_by: finalize ? (auth.user?.id ?? null) : null,
          certified_by: finalize ? (auth.user?.id ?? null) : null,
          certified_at: finalize ? now : null,
          certification_note: finalize
            ? "Certified as a true and correct record of the proceedings by the presiding clerk."
            : null,
          integrity_hash: hash,
        },
        { onConflict: "meeting_id" },
      );
      if (error) throw error;
      if (finalize) {
        await supabase.from("audit_log").insert({
          entity_type: "minutes",
          entity_id: meetingId,
          action: "minutes_certified",
          detail: `SHA-256 ${hash?.slice(0, 16)}…`,
          actor_id: auth.user?.id ?? null,
        });
      }
    },
    onSuccess: (_d, finalize) => {
      toast.success(finalize ? "Minutes finalized and certified" : "Minutes saved");
      inv("minutes");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const exportMinutes = useMutation({
    mutationFn: () => downloadMinutes(meetingId),
    onSuccess: (fileName) => toast.success(`Downloaded ${fileName}`),
    onError: (e: Error) => toast.error(e.message),
  });

  function generateMinutes() {
    const lines: string[] = [];
    lines.push(`${meeting.data?.title ?? "Meeting"} — ${formatDateTime(meeting.data?.starts_at)}`);
    lines.push("");
    lines.push("ROLL CALL");
    members.forEach((m) =>
      lines.push(`  ${m.member!.full_name}: ${attMap.get(m.member!.id) ?? "not recorded"}`),
    );
    lines.push(`  Quorum ${hasQuorum ? "present" : "NOT present"} (${presentCount} of ${quorum} required)`);
    lines.push("");
    lines.push("AGENDA");
    (agenda.data ?? []).forEach((a) => {
      lines.push(`  ${a.display_number ?? "—"}. ${a.title}${a.outcome ? ` — ${a.outcome}` : ""}`);
      (motions.data ?? [])
        .filter((m) => m.agenda_item_id === a.id)
        .forEach((m) => {
          const t = m.tally as { aye?: number; nay?: number; abstain?: number } | null;
          lines.push(
            `      Motion: ${m.text} — ${m.result ?? "pending"}${
              t ? ` (Aye ${t.aye ?? 0}, Nay ${t.nay ?? 0}, Abstain ${t.abstain ?? 0})` : ""
            }`,
          );
        });
    });
    setMinutesDraft(lines.join("\n"));
    toast.success("Draft minutes generated");
  }

  return (
    <StaffShell>
      <StaffHeader
        eyebrow={body?.name ?? "Meeting"}
        title={meeting.data?.title ?? "Meeting console"}
        description={formatDateTime(meeting.data?.starts_at)}
        actions={
          <>
            <span
              className={`rounded-sm border px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider ${
                hasQuorum
                  ? "border-success/30 bg-success/12 text-success"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {presentCount}/{body?.seat_count ?? 0} present · quorum {quorum}
            </span>
            <button
              onClick={() => setMeeting.mutate({ status: "in_progress" })}
              className="rounded-sm bg-seal px-3.5 py-2 text-sm font-semibold text-seal-foreground"
            >
              Call to order
            </button>
            <button
              onClick={() => setMeeting.mutate({ status: "adjourned", current_agenda_item_id: null })}
              className="rounded-sm border border-input px-3.5 py-2 text-sm font-semibold"
            >
              Adjourn
            </button>
          </>
        }
      />

      <div className="grid gap-6 p-6 xl:grid-cols-[18rem_minmax(0,1fr)_20rem]">
        <section className="rounded-sm border border-border bg-card p-5">
          <h2 className="font-display text-base font-bold">Roll call</h2>
          <ul className="mt-3 space-y-3">
            {members.map((m) => (
              <li key={m.member!.id}>
                <p className="text-sm font-medium text-foreground">{m.member!.full_name}</p>
                <p className="eyebrow">{m.title ?? m.seatLabel}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {ATTEND.map((s) => {
                    const active = attMap.get(m.member!.id) === s;
                    return (
                      <button
                        key={s}
                        onClick={() =>
                          setAttendance.mutate({ memberId: m.member!.id, status: s })
                        }
                        className={`rounded-sm border px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input text-muted-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
            {members.length === 0 && (
              <li className="text-sm text-muted-foreground">
                No seats assigned for this body yet.
              </li>
            )}
          </ul>
        </section>

        <SpeakerQueuePanel
          meetingId={meetingId}
          defaultSeconds={meeting.data?.speaker_seconds ?? 180}
          onSpoken={(line) => setMinutesDraft((d) => (d ? `${d}\n${line}` : line))}
        />



        <section className="space-y-6">
          <div className="rounded-sm border border-border bg-card">
            <h2 className="border-b border-rule px-5 py-3 font-display text-base font-bold">
              Agenda
            </h2>
            <ul className="divide-y divide-border">
              {(agenda.data ?? []).map((a) => (
                <li
                  key={a.id}
                  className={`flex items-center gap-3 px-5 py-3 ${
                    a.id === currentId ? "bg-accent/50" : ""
                  }`}
                >
                  <span className="docnum w-8 text-muted-foreground">
                    {a.display_number ?? "—"}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-foreground">{a.title}</span>
                  <span className="docnum text-xs text-muted-foreground">
                    {a.outcome ?? "pending"}
                  </span>
                  <button
                    onClick={() => setMeeting.mutate({ current_agenda_item_id: a.id })}
                    className="rounded-sm border border-input px-2 py-1 text-xs font-semibold"
                  >
                    {a.id === currentId ? "On the floor" : "Take up"}
                  </button>
                </li>
              ))}
              {(agenda.data ?? []).length === 0 && (
                <li className="px-5 py-8 text-sm text-muted-foreground">No agenda items.</li>
              )}
            </ul>
          </div>

          <div className="rounded-sm border border-border bg-card p-5">
            <h2 className="font-display text-base font-bold">
              Motion {currentItem ? `on ${currentItem.display_number ?? ""} ${currentItem.title}` : ""}
            </h2>
            {openMotion ? (
              <OpenMotionPanel
                motion={openMotion as never}
                members={members.map((m) => m.member!)}
                attMap={attMap}
                rule={(rules.data ?? []).find((r) => r.id === openMotion.vote_rule_id) ?? null}
                seatCount={body?.seat_count ?? members.length}
                presentCount={presentCount}
                onVote={(memberId, choice) =>
                  castVote.mutate({ motionId: openMotion.id, memberId, choice })
                }
                onClose={() => closeMotion.mutate(openMotion as never)}
              />
            ) : (
              <form
                className="mt-3 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!motionText.trim()) return;
                  createMotion.mutate();
                }}
              >
                <textarea
                  value={motionText}
                  onChange={(e) => setMotionText(e.target.value)}
                  rows={2}
                  placeholder="Motion to adopt…"
                  className="w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
                />
                <div className="grid gap-2 sm:grid-cols-3">
                  <select
                    value={mover}
                    onChange={(e) => setMover(e.target.value)}
                    className="rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
                  >
                    <option value="">Moved by…</option>
                    {members.map((m) => (
                      <option key={m.member!.id} value={m.member!.id}>
                        {m.member!.full_name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={seconder}
                    onChange={(e) => setSeconder(e.target.value)}
                    className="rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
                  >
                    <option value="">Seconded by…</option>
                    {members.map((m) => (
                      <option key={m.member!.id} value={m.member!.id}>
                        {m.member!.full_name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={ruleId}
                    onChange={(e) => setRuleId(e.target.value)}
                    className="rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
                  >
                    <option value="">Simple majority</option>
                    {(rules.data ?? []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="rounded-sm bg-seal px-3.5 py-2 text-sm font-semibold text-seal-foreground"
                >
                  Put motion on the floor
                </button>
              </form>
            )}
          </div>

          <div className="rounded-sm border border-border bg-card">
            <h2 className="border-b border-rule px-5 py-3 font-display text-base font-bold">
              Recorded motions
            </h2>
            <ul className="divide-y divide-border">
              {(motions.data ?? [])
                .filter((m) => !m.is_open)
                .map((m) => {
                  const t = m.tally as { aye?: number; nay?: number; abstain?: number; explanation?: string } | null;
                  return (
                    <li key={m.id} className="px-5 py-3">
                      <p className="text-sm text-foreground">{m.text}</p>
                      <p className="docnum mt-1 text-xs text-muted-foreground">
                        {m.result ?? "pending"} · Aye {t?.aye ?? 0} · Nay {t?.nay ?? 0} · Abstain{" "}
                        {t?.abstain ?? 0}
                      </p>
                    </li>
                  );
                })}
              {(motions.data ?? []).filter((m) => !m.is_open).length === 0 && (
                <li className="px-5 py-6 text-sm text-muted-foreground">No motions recorded.</li>
              )}
            </ul>
          </div>
        </section>

        <aside className="rounded-sm border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold">Minutes</h2>
            <div className="flex gap-1.5">
              <button
                onClick={generateMinutes}
                className="rounded-sm border border-input px-2 py-1 text-xs font-semibold"
              >
                Generate
              </button>
              <button
                onClick={() => exportMinutes.mutate()}
                disabled={exportMinutes.isPending}
                className="rounded-sm border border-input px-2 py-1 text-xs font-semibold disabled:opacity-50"
              >
                PDF
              </button>
            </div>
          </div>
          <textarea
            value={minutesDraft}
            onChange={(e) => setMinutesDraft(e.target.value)}
            rows={22}
            disabled={!!minutes.data?.finalized}
            className="mt-3 w-full rounded-sm border border-input bg-background px-2.5 py-2 font-mono text-xs leading-relaxed disabled:opacity-70"
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => saveMinutes.mutate(false)}
              disabled={!!minutes.data?.finalized}
              className="rounded-sm border border-input px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
            >
              Save draft
            </button>
            <button
              onClick={() => saveMinutes.mutate(true)}
              disabled={!!minutes.data?.finalized}
              className="rounded-sm bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              Finalize
            </button>
          </div>
          {minutes.data?.finalized ? (
            <p className="mt-2 text-xs text-success">Minutes finalized and published.</p>
          ) : null}
        </aside>
      </div>
    </StaffShell>
  );
}

function OpenMotionPanel({
  motion,
  members,
  attMap,
  rule,
  seatCount,
  presentCount,
  onVote,
  onClose,
}: {
  motion: { id: string; text: string; votes: { member_id: string; choice: string }[] };
  members: { id: string; full_name: string }[];
  attMap: Map<string, string>;
  rule: VoteRule | null;
  seatCount: number;
  presentCount: number;
  onVote: (memberId: string, choice: VoteChoice) => void;
  onClose: () => void;
}) {
  const voteMap = new Map(motion.votes.map((v) => [v.member_id, v.choice]));
  const tally = computeTally({
    votes: motion.votes.map((v) => ({ member_id: v.member_id, choice: v.choice as VoteChoice })),
    seatCount,
    presentCount,
    rule,
  });

  return (
    <div className="mt-3">
      <p className="border-l-2 border-seal pl-3 text-sm italic text-foreground">{motion.text}</p>
      <ul className="mt-4 space-y-2">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-2">
            <span className="min-w-40 flex-1 text-sm text-foreground">
              {m.full_name}
              <span className="ml-2 text-xs text-muted-foreground">
                {attMap.get(m.id) ?? "—"}
              </span>
            </span>
            {CHOICES.map((c) => {
              const active = voteMap.get(m.id) === c;
              return (
                <button
                  key={c}
                  onClick={() => onVote(m.id, c)}
                  className={`rounded-sm border px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-wide ${
                    active
                      ? "border-seal bg-seal text-seal-foreground"
                      : "border-input text-muted-foreground"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-3">
        <p className="text-sm">
          <span className="docnum">
            Aye {tally.aye} · Nay {tally.nay} · Abstain {tally.abstain} · Recuse {tally.recuse}
          </span>
          <span className="ml-2 text-muted-foreground">{tally.explanation}</span>
        </p>
        <button
          onClick={onClose}
          className="rounded-sm bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Close vote & record
        </button>
      </div>
    </div>
  );
}
