import { createServerFn } from "@tanstack/react-start";

/**
 * Idempotently provisions the fixed demo accounts (administrator, staff and
 * board members) used by the public demo site. Returns no secrets.
 */
export const ensureDemoAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const { DEMO_ACCOUNTS, DEMO_PASSWORD } = await import("@/lib/demo-credentials");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 500,
  });
  if (listError) throw new Error(listError.message);

  const [{ data: bodies }, { data: members }] = await Promise.all([
    supabaseAdmin.from("bodies").select("id,slug"),
    supabaseAdmin.from("members").select("id,full_name"),
  ]);
  const bodyBySlug = new Map((bodies ?? []).map((b) => [b.slug, b.id]));
  const memberByName = new Map((members ?? []).map((m) => [m.full_name, m.id]));

  for (const account of DEMO_ACCOUNTS) {
    let user = list.users.find((u) => u.email?.toLowerCase() === account.email);

    if (!user) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: account.name },
      });
      if (error) throw new Error(error.message);
      user = created.user;
    } else {
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
    }

    await supabaseAdmin.from("profiles").upsert(
      {
        id: user.id,
        email: account.email,
        full_name: account.name,
        title: account.title,
        department: account.department ?? null,
      },
      { onConflict: "id" },
    );

    // Exactly one role per demo login so the workspace matches the persona.
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: user.id, role: account.role }, { onConflict: "user_id,role" });
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", user.id)
      .neq("role", account.role);

    if (account.memberName) {
      const memberId = memberByName.get(account.memberName);
      if (memberId) {
        await supabaseAdmin.from("members").update({ user_id: user.id }).eq("id", memberId);
      }
    }

    for (const slug of account.submitBodies ?? []) {
      const bodyId = bodyBySlug.get(slug);
      if (!bodyId) continue;
      const { data: existing } = await supabaseAdmin
        .from("body_permissions")
        .select("id")
        .eq("user_id", user.id)
        .eq("body_id", bodyId)
        .maybeSingle();
      if (existing) {
        await supabaseAdmin
          .from("body_permissions")
          .update({ can_submit: true })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin
          .from("body_permissions")
          .insert({ user_id: user.id, body_id: bodyId, can_submit: true, note: "Demo account" });
      }
    }
  }

  return { count: DEMO_ACCOUNTS.length };
});

/** Backwards-compatible alias used by the sign-in page. */
export const ensureDemoAdmin = ensureDemoAccounts;
