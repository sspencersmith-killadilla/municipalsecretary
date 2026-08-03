import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertManager } from "@/lib/notify.server";

function daysBetween(a: string, b: string) {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

/**
 * Clerk reporting pack. All reads run with the service client after the caller's
 * clerk/administrator role is verified, so member contact columns stay behind
 * the same gate as the rest of the staff surfaces.
 */
export const getClerkReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { months?: number }) => ({
    months: Math.min(Math.max(Number(input?.months) || 12, 1), 60),
  }))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date();
    since.setMonth(since.getMonth() - data.months);
    const sinceIso = since.toISOString();

    const [meetings, attendance, members, motions, votes, items, requests, bodies] =
      await Promise.all([
        supabaseAdmin
          .from("meetings")
          .select("id,title,starts_at,status,body_id")
          .gte("starts_at", sinceIso),
        supabaseAdmin.from("attendance").select("meeting_id,member_id,status"),
        supabaseAdmin.from("members").select("id,full_name,active"),
        supabaseAdmin.from("motions").select("id,meeting_id,result,created_at"),
        supabaseAdmin.from("votes").select("motion_id,member_id,choice"),
        supabaseAdmin
          .from("legislative_items")
          .select("id,title,status,created_at,adopted_at,item_type_id,body_id,assigned_number")
          .gte("created_at", sinceIso),
        supabaseAdmin
          .from("records_requests")
          .select("id,status,received_at,due_at,closed_at,tracking_code")
          .gte("received_at", sinceIso),
        supabaseAdmin.from("bodies").select("id,name"),
      ]);

    const meetingRows = meetings.data ?? [];
    const meetingIds = new Set(meetingRows.map((m) => m.id));
    const memberName = (id: string) =>
      (members.data ?? []).find((m) => m.id === id)?.full_name ?? "Unknown";
    const bodyName = (id: string | null) =>
      (bodies.data ?? []).find((b) => b.id === id)?.name ?? "—";

    // Attendance by member
    const attendanceRows = (attendance.data ?? []).filter((a) => meetingIds.has(a.meeting_id));
    const attendanceByMember = new Map<
      string,
      { present: number; remote: number; excused: number; absent: number }
    >();
    for (const row of attendanceRows) {
      const entry =
        attendanceByMember.get(row.member_id) ??
        { present: 0, remote: 0, excused: 0, absent: 0 };
      if (row.status === "present") entry.present += 1;
      else if (row.status === "remote") entry.remote += 1;
      else if (row.status === "excused") entry.excused += 1;
      else entry.absent += 1;
      attendanceByMember.set(row.member_id, entry);
    }
    const attendanceReport = [...attendanceByMember.entries()]
      .map(([memberId, counts]) => {
        const total = counts.present + counts.remote + counts.excused + counts.absent;
        return {
          memberId,
          name: memberName(memberId),
          ...counts,
          total,
          rate: total ? Math.round(((counts.present + counts.remote) / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.rate - a.rate);

    // Voting record by member
    const motionsInRange = new Set(
      (motions.data ?? []).filter((m) => meetingIds.has(m.meeting_id)).map((m) => m.id),
    );
    const voteByMember = new Map<
      string,
      { aye: number; nay: number; abstain: number; recuse: number; absent: number }
    >();
    for (const v of votes.data ?? []) {
      if (!motionsInRange.has(v.motion_id)) continue;
      const entry =
        voteByMember.get(v.member_id) ??
        { aye: 0, nay: 0, abstain: 0, recuse: 0, absent: 0 };
      entry[v.choice as keyof typeof entry] += 1;
      voteByMember.set(v.member_id, entry);
    }
    const votingReport = [...voteByMember.entries()]
      .map(([memberId, counts]) => {
        const cast = counts.aye + counts.nay;
        return {
          memberId,
          name: memberName(memberId),
          ...counts,
          cast,
          ayeRate: cast ? Math.round((counts.aye / cast) * 100) : 0,
        };
      })
      .sort((a, b) => b.cast - a.cast);

    // Turnaround and stalled items
    const itemRows = items.data ?? [];
    const adopted = itemRows.filter((i) => i.adopted_at);
    const turnaround = {
      adoptedCount: adopted.length,
      averageDays: adopted.length
        ? Math.round(
            (adopted.reduce((sum, i) => sum + daysBetween(i.created_at, i.adopted_at!), 0) /
              adopted.length) *
              10,
          ) / 10
        : 0,
      draftCount: itemRows.filter((i) => i.status === "draft").length,
      inReviewCount: itemRows.filter((i) => i.status === "in_review").length,
    };
    const now = Date.now();
    const stalled = itemRows
      .filter(
        (i) =>
          (i.status === "draft" || i.status === "in_review") &&
          now - new Date(i.created_at).getTime() > 30 * 86_400_000,
      )
      .map((i) => ({
        id: i.id,
        title: i.title,
        number: i.assigned_number,
        status: i.status,
        body: bodyName(i.body_id),
        days: Math.round(daysBetween(i.created_at, new Date().toISOString())),
      }))
      .sort((a, b) => b.days - a.days)
      .slice(0, 25);

    // Records-request performance
    const requestRows = requests.data ?? [];
    const closed = requestRows.filter((r) => r.closed_at);
    const onTime = closed.filter((r) => !r.due_at || r.closed_at! <= r.due_at);
    const overdue = requestRows
      .filter((r) => !r.closed_at && r.due_at && new Date(r.due_at).getTime() < now)
      .map((r) => ({
        id: r.id,
        tracking: r.tracking_code,
        status: r.status,
        daysLate: Math.round(daysBetween(r.due_at!, new Date().toISOString())),
      }))
      .sort((a, b) => b.daysLate - a.daysLate);
    const recordsReport = {
      total: requestRows.length,
      open: requestRows.length - closed.length,
      closed: closed.length,
      onTimeRate: closed.length ? Math.round((onTime.length / closed.length) * 100) : 100,
      averageDays: closed.length
        ? Math.round(
            (closed.reduce((sum, r) => sum + daysBetween(r.received_at, r.closed_at!), 0) /
              closed.length) *
              10,
          ) / 10
        : 0,
      overdue,
    };

    // Meeting / agenda volume by month
    const volumeMap = new Map<string, { meetings: number; items: number }>();
    for (const m of meetingRows) {
      const key = m.starts_at.slice(0, 7);
      const entry = volumeMap.get(key) ?? { meetings: 0, items: 0 };
      entry.meetings += 1;
      volumeMap.set(key, entry);
    }
    for (const i of itemRows) {
      const key = i.created_at.slice(0, 7);
      const entry = volumeMap.get(key) ?? { meetings: 0, items: 0 };
      entry.items += 1;
      volumeMap.set(key, entry);
    }
    const volume = [...volumeMap.entries()]
      .map(([month, counts]) => ({ month, ...counts }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      generatedAt: new Date().toISOString(),
      months: data.months,
      meetingCount: meetingRows.length,
      attendance: attendanceReport,
      voting: votingReport,
      turnaround,
      stalled,
      records: recordsReport,
      volume,
    };
  });
