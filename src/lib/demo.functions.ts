import { createServerFn } from "@tanstack/react-start";

/**
 * Idempotently provisions the fixed demo administrator account used by the
 * public demo site. Creates nothing else and returns no secrets.
 */
export const ensureDemoAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD, DEMO_ADMIN_NAME } = await import(
    "@/lib/demo-credentials"
  );
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) throw new Error(listError.message);

  let user = list.users.find((u) => u.email?.toLowerCase() === DEMO_ADMIN_EMAIL);

  if (!user) {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_ADMIN_EMAIL,
      password: DEMO_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: DEMO_ADMIN_NAME },
    });
    if (error) throw new Error(error.message);
    user = created.user;
  } else {
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: DEMO_ADMIN_PASSWORD,
      email_confirm: true,
    });
  }

  await supabaseAdmin
    .from("profiles")
    .upsert(
      { id: user.id, email: DEMO_ADMIN_EMAIL, full_name: DEMO_ADMIN_NAME, title: "City Clerk" },
      { onConflict: "id" },
    );

  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });

  return { email: DEMO_ADMIN_EMAIL };
});
