import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertManager,
  resolveSubscribers,
  sendMessages,
  type NoticeKind,
  type OutboundMessage,
} from "@/lib/notify.server";

function origin() {
  try {
    const request = getRequest();
    return new URL(request.url).origin;
  } catch {
    return "";
  }
}

const MEETING_KINDS = [
  "agenda_posted",
  "agenda_amended",
  "meeting_cancelled",
  "minutes_published",
] as const;
type MeetingNoticeKind = (typeof MEETING_KINDS)[number];

const COLUMN_FOR: Record<MeetingNoticeKind, "notify_agendas" | "notify_minutes" | "notify_changes"> =
  {
    agenda_posted: "notify_agendas",
    agenda_amended: "notify_changes",
    meeting_cancelled: "notify_changes",
    minutes_published: "notify_minutes",
  };

function longDate(value: string, timezone?: string | null) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone || undefined,
  });
}

/** Fan a meeting notice out to every confirmed subscriber for that body. */
export const dispatchMeetingNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { meetingId: string; kind: string }) => {
    const kind = MEETING_KINDS.find((k) => k === input?.kind);
    if (!kind) throw new Error("Unknown notice type");
    if (!input?.meetingId) throw new Error("A meeting is required");
    return { meetingId: input.meetingId, kind };
  })
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: meeting, error } = await supabaseAdmin
      .from("meetings")
      .select("id,title,starts_at,location,body_id,cancellation_reason,bodies(name)")
      .eq("id", data.meetingId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!meeting) throw new Error("Meeting not found");

    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("municipality_name,timezone,contact_email")
      .eq("id", 1)
      .maybeSingle();

    const bodyName =
      (meeting as { bodies?: { name?: string } | null }).bodies?.name ?? "the governing body";
    const city = settings?.municipality_name ?? "the municipality";
    const when = longDate(meeting.starts_at, settings?.timezone);
    const base = origin();
    const link = `${base}/meetings/${meeting.id}`;

    const subjects: Record<MeetingNoticeKind, string> = {
      agenda_posted: `Agenda posted — ${bodyName}, ${when}`,
      agenda_amended: `Amended agenda — ${bodyName}, ${when}`,
      meeting_cancelled: `Meeting cancelled — ${bodyName}, ${when}`,
      minutes_published: `Minutes published — ${bodyName}, ${when}`,
    };

    const bodies: Record<MeetingNoticeKind, string> = {
      agenda_posted: `The agenda for the ${bodyName} meeting of ${city} on ${when} at ${
        meeting.location ?? "the posted location"
      } is now available. View the agenda and packet: ${link}`,
      agenda_amended: `The agenda for the ${bodyName} meeting on ${when} has been amended. Review the current version: ${link}`,
      meeting_cancelled: `The ${bodyName} meeting scheduled for ${when} has been cancelled.${
        meeting.cancellation_reason ? ` Reason: ${meeting.cancellation_reason}.` : ""
      } Details: ${link}`,
      minutes_published: `Minutes for the ${bodyName} meeting of ${when} have been published: ${link}`,
    };

    const recipients = await resolveSubscribers({
      bodyId: meeting.body_id,
      column: COLUMN_FOR[data.kind],
    });

    const messages: OutboundMessage[] = recipients.map((recipient) => ({
      kind: data.kind as NoticeKind,
      recipient,
      subject: subjects[data.kind],
      bodyText: bodies[data.kind],
      entityType: "meeting",
      entityId: meeting.id,
      bodyId: meeting.body_id,
    }));

    return sendMessages(messages);
  });

/** Public double opt-in sign-up. */
export const subscribeToNotices = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; bodyId?: string | null }) => {
    const email = (input?.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 320) {
      throw new Error("Enter a valid email address");
    }
    return { email, bodyId: input?.bodyId || null };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        { email: data.email, body_id: data.bodyId, confirmed: false },
        { onConflict: "email,body_id" },
      )
      .select("token,email")
      .maybeSingle();

    if (error || !row) {
      const { data: existing } = await supabaseAdmin
        .from("subscriptions")
        .select("token,email")
        .eq("email", data.email)
        .limit(1)
        .maybeSingle();
      if (!existing) throw new Error(error?.message ?? "Could not record that subscription");
      await sendMessages([confirmationMessage(existing.email, existing.token)]);
      return { ok: true };
    }

    await sendMessages([confirmationMessage(row.email, row.token)]);
    return { ok: true };
  });

function confirmationMessage(email: string, token: string): OutboundMessage {
  const link = `${origin()}/manage-notices?token=${token}`;
  return {
    kind: "subscription_confirm",
    recipient: email,
    subject: "Confirm your meeting notice subscription",
    bodyText: `Confirm your subscription to meeting notices: ${link}`,
    entityType: "subscription",
  };
}

const tokenValidator = (input: { token: string }) => {
  const token = (input?.token ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(token)) throw new Error("Invalid or expired link");
  return { token };
};

export const getSubscription = createServerFn({ method: "POST" })
  .inputValidator(tokenValidator)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("subscriptions")
      .select(
        "email,confirmed,confirmed_at,unsubscribed_at,notify_agendas,notify_minutes,notify_changes,body_id,bodies(name)",
      )
      .eq("token", data.token)
      .maybeSingle();
    if (!row) throw new Error("That link is no longer valid.");
    return {
      email: row.email,
      confirmed: row.confirmed,
      unsubscribed: !!row.unsubscribed_at,
      notifyAgendas: row.notify_agendas,
      notifyMinutes: row.notify_minutes,
      notifyChanges: row.notify_changes,
      bodyName: (row as { bodies?: { name?: string } | null }).bodies?.name ?? null,
    };
  });

export const confirmSubscription = createServerFn({ method: "POST" })
  .inputValidator(tokenValidator)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ confirmed: true, confirmed_at: new Date().toISOString(), unsubscribed_at: null })
      .eq("token", data.token);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSubscriptionPreferences = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      token: string;
      notifyAgendas: boolean;
      notifyMinutes: boolean;
      notifyChanges: boolean;
    }) => ({
      ...tokenValidator(input),
      notifyAgendas: !!input?.notifyAgendas,
      notifyMinutes: !!input?.notifyMinutes,
      notifyChanges: !!input?.notifyChanges,
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({
        notify_agendas: data.notifyAgendas,
        notify_minutes: data.notifyMinutes,
        notify_changes: data.notifyChanges,
      })
      .eq("token", data.token);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unsubscribeFromNotices = createServerFn({ method: "POST" })
  .inputValidator(tokenValidator)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ unsubscribed_at: new Date().toISOString(), confirmed: false })
      .eq("token", data.token);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
