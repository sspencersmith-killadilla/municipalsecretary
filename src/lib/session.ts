import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "admin"
  | "clerk"
  | "attorney"
  | "department_staff"
  | "board_member"
  | "viewer";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrator",
  clerk: "City Clerk",
  attorney: "City Attorney",
  department_staff: "Department Staff",
  board_member: "Board Member",
  viewer: "Viewer",
};

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id ?? null;

  const rolesQuery = useQuery({
    queryKey: ["my-roles", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });

  const roles = rolesQuery.data ?? [];

  return {
    session,
    user: session?.user ?? null,
    userId,
    roles,
    loading: loading || (!!userId && rolesQuery.isLoading),
    isStaff: roles.length > 0,
    isAdmin: roles.includes("admin"),
    canManage: roles.includes("admin") || roles.includes("clerk"),
    hasRole: (role: AppRole) => roles.includes(role),
  };
}
