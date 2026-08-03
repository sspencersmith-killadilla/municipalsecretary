import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, useSession, type AppRole } from "@/lib/session";
import {
  deactivateStaffMember,
  inviteStaffMember,
  linkMemberAccount,
  listStaffDirectory,
  setStaffBoardAccess,
  setStaffRole,
} from "@/lib/admin-users.functions";

const ROLES: AppRole[] = [
  "admin",
  "clerk",
  "attorney",
  "department_staff",
  "board_member",
  "viewer",
];

export function StaffUsersPanel() {
  const qc = useQueryClient();
  const { isAdmin } = useSession();
  const directory = useServerFn(listStaffDirectory);
  const invite = useServerFn(inviteStaffMember);
  const changeRole = useServerFn(setStaffRole);
  const changeBoards = useServerFn(setStaffBoardAccess);
  const deactivate = useServerFn(deactivateStaffMember);
  const linkMember = useServerFn(linkMemberAccount);

  const [form, setForm] = useState({
    email: "",
    fullName: "",
    title: "",
    department: "",
    role: "department_staff" as AppRole,
    bodyIds: [] as string[],
  });
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

  const bodies = useQuery({
    queryKey: ["admin", "bodies-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bodies").select("id,name").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const members = useQuery({
    queryKey: ["admin", "members-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id,full_name,user_id")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const people = useQuery({
    queryKey: ["admin", "staff-directory"],
    queryFn: () => directory({}),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "staff-directory"] });
    qc.invalidateQueries({ queryKey: ["admin", "members-lite"] });
  };

  const inviteMutation = useMutation({
    mutationFn: () => invite({ data: form }),
    onSuccess: (result) => {
      toast.success("Account created");
      if (result.password) setIssued({ email: form.email, password: result.password });
      setForm({ ...form, email: "", fullName: "", title: "", bodyIds: [] });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMutation = useMutation({
    mutationFn: (vars: { userId: string; role: AppRole }) => changeRole({ data: vars }),
    onSuccess: () => {
      toast.success("Role updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const boardsMutation = useMutation({
    mutationFn: (vars: { userId: string; bodyIds: string[] }) => changeBoards({ data: vars }),
    onSuccess: () => {
      toast.success("Board access updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => deactivate({ data: { userId } }),
    onSuccess: () => {
      toast.success("Access revoked — the person's history is preserved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkMutation = useMutation({
    mutationFn: (vars: { memberId: string; userId: string | null }) => linkMember({ data: vars }),
    onSuccess: () => {
      toast.success("Member record linked");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleBody = (id: string) =>
    setForm((f) => ({
      ...f,
      bodyIds: f.bodyIds.includes(id) ? f.bodyIds.filter((b) => b !== id) : [...f.bodyIds, id],
    }));

  if (!isAdmin) {
    return (
      <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
        Only administrators can add staff or change roles.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-sm border border-border bg-card">
        <header className="border-b border-border px-5 py-3">
          <h2 className="font-display text-base">Invite a colleague</h2>
        </header>
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            inviteMutation.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Work email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              type="email"
              required
            />
            <Field
              label="Full name"
              value={form.fullName}
              onChange={(v) => setForm({ ...form, fullName: v })}
            />
            <Field
              label="Title"
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
            />
            <Field
              label="Department"
              value={form.department}
              onChange={(v) => setForm({ ...form, department: v })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Role</span>
              <select
                className="w-full rounded-sm border border-input bg-background px-3 py-2"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="text-sm">
              <legend className="mb-1 text-muted-foreground">Boards they may submit to</legend>
              <div className="flex flex-wrap gap-2">
                {(bodies.data ?? []).map((b) => (
                  <label
                    key={b.id}
                    className={`cursor-pointer rounded-sm border px-2.5 py-1 text-xs ${
                      form.bodyIds.includes(b.id)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={form.bodyIds.includes(b.id)}
                      onChange={() => toggleBody(b.id)}
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <button
            className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            disabled={inviteMutation.isPending}
          >
            {inviteMutation.isPending ? "Creating…" : "Create account"}
          </button>
        </form>
        {issued && (
          <div className="border-t border-border bg-muted/40 p-5 text-sm">
            <p className="font-medium">One-time password for {issued.email}</p>
            <code className="mt-2 block rounded-sm bg-background px-3 py-2 font-mono">
              {issued.password}
            </code>
            <p className="mt-2 text-muted-foreground">
              Hand this over in person or by phone and ask them to change it after signing in. It is
              shown once and never stored in readable form.
            </p>
            <button
              className="mt-3 rounded-sm border border-border px-3 py-1 text-xs"
              onClick={() => setIssued(null)}
            >
              Dismiss
            </button>
          </div>
        )}
      </section>

      <section className="rounded-sm border border-border bg-card">
        <header className="border-b border-border px-5 py-3">
          <h2 className="font-display text-base">Staff directory</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Person</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Boards</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {(people.data ?? []).map((p) => (
                <tr key={p.id} className="border-b border-border/60 align-top last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.fullName ?? p.email}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                    {p.department && (
                      <p className="text-xs text-muted-foreground">{p.department}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-sm border border-input bg-background px-2 py-1 text-xs"
                      value={p.roles[0] ?? "viewer"}
                      onChange={(e) =>
                        roleMutation.mutate({
                          userId: p.id,
                          role: e.target.value as AppRole,
                        })
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(bodies.data ?? []).map((b) => {
                        const on = p.bodyIds.includes(b.id);
                        return (
                          <button
                            key={b.id}
                            className={`rounded-sm border px-2 py-0.5 text-xs ${
                              on ? "border-primary bg-primary/10 text-primary" : "border-border"
                            }`}
                            onClick={() =>
                              boardsMutation.mutate({
                                userId: p.id,
                                bodyIds: on
                                  ? p.bodyIds.filter((x) => x !== b.id)
                                  : [...p.bodyIds, b.id],
                              })
                            }
                          >
                            {b.name}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="rounded-sm border border-border px-2 py-1 text-xs hover:bg-accent"
                      onClick={() => deactivateMutation.mutate(p.id)}
                    >
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
              {!people.data?.length && (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>
                    {people.isLoading ? "Loading…" : "No staff accounts yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-sm border border-border bg-card">
        <header className="border-b border-border px-5 py-3">
          <h2 className="font-display text-base">Link board members to logins</h2>
        </header>
        <div className="space-y-3 p-5 text-sm">
          <p className="text-muted-foreground">
            Linking a seat holder to an account lets them open their own meeting briefings.
          </p>
          {(members.data ?? []).map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3">
              <span className="min-w-48 font-medium">{m.full_name}</span>
              <select
                className="rounded-sm border border-input bg-background px-2 py-1 text-xs"
                value={m.user_id ?? ""}
                onChange={(e) =>
                  linkMutation.mutate({ memberId: m.id, userId: e.target.value || null })
                }
              >
                <option value="">Not linked</option>
                {(people.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName ?? p.email}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <input
        className="w-full rounded-sm border border-input bg-background px-3 py-2"
        value={value}
        type={type}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
