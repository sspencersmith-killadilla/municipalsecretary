import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/lib/session";
import { ensureDemoAdmin } from "@/lib/demo.functions";
import { DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD } from "@/lib/demo-credentials";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff Sign In — Municipal Legislative Portal" },
      {
        name: "description",
        content:
          "Secure sign in for clerks, attorneys and department staff to draft legislation and run meetings.",
      },
      { property: "og:title", content: "Staff Sign In" },
      { property: "og:description", content: "Secure staff access to the legislative workspace." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { session } = useSession();

  useEffect(() => {
    if (session) navigate({ to: "/dashboard", replace: true });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created. An administrator must assign your staff role.");
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function demoSignIn() {
    setBusy(true);
    try {
      await ensureDemoAdmin();
      const { error } = await supabase.auth.signInWithPassword({
        email: DEMO_ADMIN_EMAIL,
        password: DEMO_ADMIN_PASSWORD,
      });
      if (error) throw error;
      toast.success("Signed in as the demo administrator");
      navigate({ to: "/staff/admin", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-primary p-12 text-primary-foreground lg:flex">
        <Link to="/" className="flex items-center gap-3">
          <Landmark className="h-7 w-7 text-brass" strokeWidth={1.5} />
          <span className="font-display text-lg font-bold">CivicLedger</span>
        </Link>
        <div className="max-w-md">
          <p className="eyebrow text-brass">Staff workspace</p>
          <h2 className="mt-3 font-display text-3xl leading-tight font-bold">
            Draft, route, agendize, vote and publish — one continuous record.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/70">
            Numbering, quorum and vote thresholds follow the rules your clerk configures in the
            administration portal.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/50">Authorized personnel only.</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background px-5 py-12">
        <div className="w-full max-w-sm">
          <p className="eyebrow">{mode === "signin" ? "Sign in" : "Create account"}</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-foreground">Staff portal</h1>

          <div className="mt-6 rounded-sm border border-brass/50 bg-brass/8 p-4">
            <p className="eyebrow text-seal">Demo site — administrator access</p>
            <dl className="mt-2 space-y-0.5 text-xs">
              <div className="flex gap-2">
                <dt className="w-16 text-muted-foreground">Email</dt>
                <dd className="docnum text-foreground">{DEMO_ADMIN_EMAIL}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 text-muted-foreground">Password</dt>
                <dd className="docnum text-foreground">{DEMO_ADMIN_PASSWORD}</dd>
              </div>
            </dl>
            <button
              onClick={demoSignIn}
              disabled={busy}
              className="mt-3 w-full rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              Sign in as demo administrator
            </button>
            <p className="mt-2 text-[0.68rem] leading-relaxed text-muted-foreground">
              Full access to the administration portal: bodies, seats, item types, numbering,
              vote rules, members and municipality settings.
            </p>
          </div>

          <button
            onClick={google}
            className="mt-6 w-full rounded-sm border border-input bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <Field label="Full name" value={fullName} onChange={setFullName} />
            )}
            <Field label="Email" type="email" value={email} onChange={setEmail} />
            <Field label="Password" type="password" value={password} onChange={setPassword} />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-sm bg-seal px-4 py-2.5 text-sm font-semibold text-seal-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 text-xs text-muted-foreground hover:text-seal"
          >
            {mode === "signin"
              ? "Need an account? Register as staff"
              : "Already registered? Sign in"}
          </button>

          <Link to="/" className="mt-8 block text-xs text-muted-foreground hover:text-seal">
            ← Back to the public portal
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
      />
    </label>
  );
}
