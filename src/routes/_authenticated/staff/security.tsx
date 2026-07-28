import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, StaffHeader } from "@/components/StaffShell";

export const Route = createFileRoute("/_authenticated/staff/security")({
  head: () => ({
    meta: [
      { title: "Account Security — CivicLedger Staff" },
      {
        name: "description",
        content:
          "Enroll an authenticator app for two-factor authentication on your clerk workspace account.",
      },
      { property: "og:title", content: "Account Security" },
      {
        property: "og:description",
        content: "Two-factor authentication for municipal clerk staff accounts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountSecurity,
});

type Enrolling = { id: string; qr: string; secret: string } | null;

function AccountSecurity() {
  const qc = useQueryClient();
  const [enrolling, setEnrolling] = useState<Enrolling>(null);
  const [code, setCode] = useState("");

  const factors = useQuery({
    queryKey: ["mfa", "factors"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data.totp ?? [];
    },
  });

  const startEnroll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmEnroll = useMutation({
    mutationFn: async () => {
      if (!enrolling) throw new Error("Start enrollment first");
      const challenge = await supabase.auth.mfa.challenge({ factorId: enrolling.id });
      if (challenge.error) throw challenge.error;
      const verify = await supabase.auth.mfa.verify({
        factorId: enrolling.id,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verify.error) throw verify.error;
    },
    onSuccess: () => {
      toast.success("Two-factor authentication enabled");
      setEnrolling(null);
      setCode("");
      qc.invalidateQueries({ queryKey: ["mfa", "factors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unenroll = useMutation({
    mutationFn: async (factorId: string) => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Authenticator removed");
      qc.invalidateQueries({ queryKey: ["mfa", "factors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verified = (factors.data ?? []).filter((f) => f.status === "verified");

  return (
    <StaffShell>
      <StaffHeader
        title="Account security"
        description="Clerk, attorney and administrator accounts should carry a second factor before go-live."
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-sm border border-rule bg-card p-5">
          <h2 className="font-display text-lg font-bold">Authenticator app (TOTP)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use any standards-based authenticator — Microsoft Authenticator, Google Authenticator,
            1Password or Authy. Codes rotate every 30 seconds.
          </p>

          <div className="mt-4 flex items-center gap-2 text-sm">
            {verified.length > 0 ? (
              <>
                <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />
                <span className="font-semibold text-success">
                  Two-factor authentication is active on this account.
                </span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4 text-seal" aria-hidden="true" />
                <span className="font-semibold text-seal">
                  No second factor is enrolled on this account.
                </span>
              </>
            )}
          </div>

          {verified.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {verified.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-rule px-3 py-2 text-sm"
                >
                  <span>
                    {f.friendly_name || "Authenticator"}
                    <span className="docnum block text-[0.65rem] text-muted-foreground">
                      Added {new Date(f.created_at).toLocaleDateString()}
                    </span>
                  </span>
                  <button
                    onClick={() => unenroll.mutate(f.id)}
                    disabled={unenroll.isPending}
                    className="rounded-sm border border-input px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {enrolling ? (
            <div className="mt-5 rounded-sm border border-brass/50 bg-brass/8 p-4">
              <p className="eyebrow text-seal">Step 1 — scan</p>
              <img
                src={enrolling.qr}
                alt="QR code to add this account to your authenticator app"
                className="mt-2 h-44 w-44 bg-white p-2"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Can&rsquo;t scan? Enter this setup key manually:{" "}
                <code className="docnum normal-case">{enrolling.secret}</code>
              </p>
              <p className="eyebrow mt-4 text-seal">Step 2 — confirm</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  aria-label="Six digit verification code"
                  className="docnum w-40 rounded-sm border border-input bg-card px-3 py-2 text-sm normal-case"
                />
                <button
                  onClick={() => confirmEnroll.mutate()}
                  disabled={confirmEnroll.isPending || code.trim().length < 6}
                  className="rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                >
                  Verify and enable
                </button>
                <button
                  onClick={() => setEnrolling(null)}
                  className="rounded-sm border border-input px-3 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => startEnroll.mutate()}
              disabled={startEnroll.isPending}
              className="mt-5 rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              {verified.length > 0 ? "Add another authenticator" : "Set up authenticator app"}
            </button>
          )}
        </section>

        <aside aria-label="Operational guidance" className="space-y-4">
          <div className="rounded-sm border border-rule bg-card p-4">
            <h2 className="eyebrow">Recommended policy</h2>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
              <li>Require a second factor for every administrator, clerk and attorney account.</li>
              <li>Keep at least two administrators enrolled so lockout never stalls a meeting.</li>
              <li>
                Record the enrollment date in your IT security file; regulators frequently ask.
              </li>
              <li>Remove factors the same day an employee separates.</li>
            </ul>
          </div>
          <div className="rounded-sm border border-rule bg-card p-4">
            <h2 className="eyebrow">Recovery</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              If a staff member loses their device, another administrator can remove the stale
              factor from the backend user record and the employee re-enrolls at their next sign-in.
            </p>
          </div>
        </aside>
      </div>
    </StaffShell>
  );
}
