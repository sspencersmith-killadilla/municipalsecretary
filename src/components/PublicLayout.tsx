import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

const NAV = [
  { to: "/meetings", label: "Meetings" },
  { to: "/legislation", label: "Legislation" },
  { to: "/bodies", label: "Boards & Councils" },
] as const;

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings();
  const { isStaff } = useSession();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:outline-none focus:ring-2 focus:ring-seal"
      >
        Skip to main content
      </a>
      <header className="border-b border-rule bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
          <Link to="/" className="flex items-center gap-3">
            <Landmark className="h-7 w-7 text-brass" strokeWidth={1.5} aria-hidden="true" />
            <span className="leading-tight">
              <span className="block font-display text-lg font-bold">
                {settings?.municipality_name ?? "CivicLedger"}
              </span>
              <span className="block text-[0.68rem] uppercase tracking-[0.16em] text-primary-foreground/70">
                Legislative Record
              </span>
            </span>
          </Link>
          <nav aria-label="Primary" className="ml-auto flex flex-wrap items-center gap-1 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-sm px-3 py-1.5 font-medium text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground [&.active]:bg-primary-foreground/15 [&.active]:text-primary-foreground"
              >
                {n.label}
              </Link>
            ))}
            <Link
              to={isStaff ? "/dashboard" : "/auth"}
              className="ml-2 rounded-sm border border-brass/60 px-3 py-1.5 font-medium text-brass transition-colors hover:bg-brass hover:text-primary"
            >
              {isStaff ? "Staff Portal" : "Staff Sign In"}
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>

      <footer aria-label="Site information" className="mt-16 border-t border-rule bg-secondary">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            {settings?.municipality_name ?? "CivicLedger"} — official legislative record.
            {settings?.contact_email ? ` Clerk: ${settings.contact_email}` : ""}
          </p>
          <p className="docnum flex items-center gap-4">
            <Link to="/subscribe" className="hover:text-seal hover:underline">
              Subscribe
            </Link>
            <Link to="/records-requests" className="hover:text-seal hover:underline">
              Records requests
            </Link>
            <a href="/api/public/rss.xml" className="hover:text-seal hover:underline">
              RSS
            </a>
            <Link to="/docs/clerk-handbook" className="hover:text-seal hover:underline">
              Clerk handbook
            </Link>
            <Link to="/docs/self-hosting" className="hover:text-seal hover:underline">
              Self-hosting guide
            </Link>


            <Link to="/accessibility" className="hover:text-seal hover:underline">
              Accessibility
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-rule bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-5 py-10">
        <div className="max-w-2xl">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions}
      </div>
    </div>
  );
}

export function StatusPill({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider ${tone}`}
    >
      {label}
    </span>
  );
}
