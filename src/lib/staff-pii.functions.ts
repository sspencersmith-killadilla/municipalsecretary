import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Contact details on comment cards and member records are personally identifying
 * and must never travel over the public Data API. These server functions verify the
 * caller holds a staff role before returning the PII columns.
 */
async function assertStaff(
  supabase: { from: (t: string) => any },
  userId: string,
  manageOnly = false,
) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error("Unauthorized");
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (roles.length === 0) throw new Error("Unauthorized");
  if (manageOnly && !roles.some((r: string) => r === "admin" || r === "clerk")) {
    throw new Error("Unauthorized");
  }
}

const STATUSES = ["pending", "approved", "rejected"] as const;

export const listCommentsForModeration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status: string }) => {
    const status = STATUSES.find((s) => s === input?.status);
    if (!status) throw new Error("Invalid status");
    return { status };
  })
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("public_comments")
      .select("*, meetings(id,title,starts_at), agenda_items(title,display_number)")
      .eq("status", data.status)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listMembersWithContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.supabase as never, context.userId, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("members")
      .select("id,full_name,email,active")
      .order("full_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
