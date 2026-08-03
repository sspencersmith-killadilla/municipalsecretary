import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sequential number assignment. The underlying SECURITY DEFINER routine is no
 * longer executable by signed-in Data API clients; this server function
 * verifies the caller holds a clerk/admin role before invoking it with the
 * trusted server client.
 */
export const assignItemNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { item_id: string }) => {
    const item_id = typeof input?.item_id === "string" ? input.item_id.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(item_id)) throw new Error("Invalid item.");
    return { item_id };
  })
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error("Unauthorized");
    const allowed = (roles ?? []).some(
      (r: { role: string }) => r.role === "admin" || r.role === "clerk",
    );
    if (!allowed) throw new Error("Only clerks and administrators can assign numbers.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: number, error } = await supabaseAdmin.rpc("admin_assign_item_number", {
      _item_id: data.item_id,
      _actor: context.userId,
    });
    if (error) {
      console.error("[numbering] admin_assign_item_number failed", error);
      throw new Error(error.message || "Numbering failed.");
    }
    return number as string;
  });
