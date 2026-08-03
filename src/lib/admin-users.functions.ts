import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertManager } from "@/lib/notify.server";

const ROLES = [
  "admin",
  "clerk",
  "attorney",
  "department_staff",
  "board_member",
  "viewer",
] as const;
type Role = (typeof ROLES)[number];

async function assertAdmin(supabase: { from: (t: string) => any }, userId: string) {
  const roles = await assertManager(supabase as never, userId);
  if (!roles.includes("admin")) throw new Error("Only administrators can do that.");
}

export const listStaffDirectory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles }, { data: roles }, { data: perms }, { data: members }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id,email,full_name,title,department"),
        supabaseAdmin.from("user_roles").select("user_id,role"),
        supabaseAdmin.from("body_permissions").select("user_id,body_id,can_submit"),
        supabaseAdmin.from("members").select("id,full_name,user_id,active"),
      ]);

    return (profiles ?? [])
      .map((p) => ({
        id: p.id,
        email: p.email,
        fullName: p.full_name,
        title: p.title,
        department: p.department,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as Role),
        bodyIds: (perms ?? [])
          .filter((r) => r.user_id === p.id && r.can_submit)
          .map((r) => r.body_id),
        memberId: (members ?? []).find((m) => m.user_id === p.id)?.id ?? null,
      }))
      .sort((a, b) => (a.fullName ?? a.email ?? "").localeCompare(b.fullName ?? b.email ?? ""));
  });

export const listInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context.supabase as never, context.userId);
    const { data, error } = await context.supabase
      .from("staff_invites")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

function tempPassword() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return (
    "Cv-" +
    Array.from(bytes, (b) => b.toString(36))
      .join("")
      .slice(0, 16) +
    "!7"
  );
}

/**
 * Creates the account, grants the role and board access, and records the
 * invitation. The one-time password is returned to the inviting administrator
 * so a colleague can be onboarded even before the sender domain is live.
 */
export const inviteStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      email: string;
      fullName?: string;
      title?: string;
      department?: string;
      role: string;
      bodyIds?: string[];
    }) => {
      const email = (input?.email ?? "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address");
      const role = ROLES.find((r) => r === input?.role);
      if (!role) throw new Error("Choose a role");
      return {
        email,
        fullName: (input.fullName ?? "").trim() || null,
        title: (input.title ?? "").trim() || null,
        department: (input.department ?? "").trim() || null,
        role,
        bodyIds: Array.isArray(input.bodyIds) ? input.bodyIds.filter(Boolean).slice(0, 40) : [],
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const password = tempPassword();
    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName ?? data.email },
    });

    let userId = created.data.user?.id ?? null;
    let issuedPassword: string | null = password;

    if (!userId) {
      const message = created.error?.message ?? "";
      if (!/already/i.test(message)) throw new Error(message || "Could not create the account");
      issuedPassword = null;
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", data.email)
        .maybeSingle();
      userId = existing?.id ?? null;
      if (!userId) throw new Error("That address already exists but has no profile record.");
    }

    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.fullName ?? undefined,
        title: data.title ?? undefined,
        department: data.department ?? undefined,
      })
      .eq("id", userId);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: data.role });

    if (data.bodyIds.length) {
      await supabaseAdmin.from("body_permissions").upsert(
        data.bodyIds.map((bodyId) => ({ user_id: userId!, body_id: bodyId, can_submit: true })),
        { onConflict: "user_id,body_id" },
      );
    }

    await supabaseAdmin.from("staff_invites").insert({
      email: data.email,
      full_name: data.fullName,
      title: data.title,
      department: data.department,
      role: data.role,
      body_ids: data.bodyIds,
      invited_by: context.userId,
      accepted_at: issuedPassword ? null : new Date().toISOString(),
    });

    return { userId, password: issuedPassword };
  });

export const setStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: string }) => {
    const role = ROLES.find((r) => r === input?.role);
    if (!role || !input?.userId) throw new Error("Choose a person and a role");
    return { userId: input.userId, role };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("You cannot remove your own administrator access.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setStaffBoardAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; bodyIds: string[] }) => ({
    userId: input?.userId ?? "",
    bodyIds: Array.isArray(input?.bodyIds) ? input.bodyIds.filter(Boolean).slice(0, 40) : [],
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    if (!data.userId) throw new Error("Choose a person");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("body_permissions").delete().eq("user_id", data.userId);
    if (data.bodyIds.length) {
      const { error } = await supabaseAdmin
        .from("body_permissions")
        .insert(data.bodyIds.map((bodyId) => ({ user_id: data.userId, body_id: bodyId, can_submit: true })));
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Revokes all access without deleting the person's audit trail. */
export const deactivateStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => ({ userId: input?.userId ?? "" }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    if (!data.userId) throw new Error("Choose a person");
    if (data.userId === context.userId) throw new Error("You cannot deactivate your own account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("body_permissions").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: "viewer" });
    return { ok: true };
  });

/** Links a board member record to a login so they see their own briefings. */
export const linkMemberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { memberId: string; userId: string | null }) => ({
    memberId: input?.memberId ?? "",
    userId: input?.userId || null,
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    if (!data.memberId) throw new Error("Choose a member record");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("members")
      .update({ user_id: data.userId })
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
