/**
 * Server-only notification plumbing.
 *
 * Recipient resolution and the delivery record live here. Actual delivery runs
 * through Lovable's managed email API once a sender domain is connected; until
 * then every message is recorded with a `pending_email_setup` status so the
 * clerk can see exactly what would have gone out and re-send it afterwards.
 */

import type { NoticeKind } from "@/lib/notices";

export type { NoticeKind };


export type OutboundMessage = {
  kind: NoticeKind;
  recipient: string;
  subject: string;
  bodyText: string;
  entityType?: string | null;
  entityId?: string | null;
  bodyId?: string | null;
};

/**
 * Set to true once `email_domain` scaffolding is in place. Kept as a single
 * switch so wiring the managed sender is a one-line change.
 */
const EMAIL_SENDING_ENABLED = false;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function recordDelivery(
  message: OutboundMessage,
  status: string,
  detail?: string | null,
) {
  const db = await admin();
  await db.from("notification_log").insert({
    kind: message.kind,
    recipient: message.recipient,
    subject: message.subject,
    entity_type: message.entityType ?? null,
    entity_id: message.entityId ?? null,
    body_id: message.bodyId ?? null,
    status,
    detail: detail ?? null,
  });
}

export async function sendMessages(messages: OutboundMessage[]) {
  let sent = 0;
  let pending = 0;
  let failed = 0;

  for (const message of messages) {
    if (!EMAIL_SENDING_ENABLED) {
      await recordDelivery(
        message,
        "pending_email_setup",
        "Queued — connect a sender domain to release this notice.",
      );
      pending += 1;
      continue;
    }
    try {
      // Delivery is wired here once the managed sender domain is connected.
      await recordDelivery(message, "sent");
      sent += 1;
    } catch (error) {
      await recordDelivery(message, "failed", (error as Error).message);
      failed += 1;
    }
  }

  return { sent, pending, failed, total: messages.length };
}

type SubscriberFilter = {
  bodyId: string | null;
  column: "notify_agendas" | "notify_minutes" | "notify_changes";
};

export async function resolveSubscribers({ bodyId, column }: SubscriberFilter) {
  const db = await admin();
  let query = db
    .from("subscriptions")
    .select("email, body_id")
    .eq("confirmed", true)
    .is("unsubscribed_at", null)
    .eq(column, true);

  if (bodyId) query = query.or(`body_id.is.null,body_id.eq.${bodyId}`);
  else query = query.is("body_id", null);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const emails: string[] = [];
  for (const row of data ?? []) {
    const email = (row.email ?? "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return emails;
}

export async function assertManager(
  supabase: { from: (table: string) => any },
  userId: string,
) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Unauthorized");
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.some((r: string) => r === "admin" || r === "clerk")) {
    throw new Error("Only clerks and administrators can do that.");
  }
  return roles as string[];
}
