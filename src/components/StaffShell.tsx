import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  FilePlus2,
  CalendarDays,
  CheckSquare,
  Gavel,
  Settings2,
  LayoutDashboard,
  LogOut,
  Landmark,
  MessageSquare,
  Archive,
  ScrollText,
  DatabaseZap,
  BookOpen,
  ShieldCheck,
  ClipboardList,
  Menu,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, ROLE_LABELS } from "@/lib/session";
import { useSettings } from "@/components/PublicLayout";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/staff/submit", label: "Submit an Item", icon: FilePlus2 },
  { to: "/staff/legislation", label: "Legislative Files", icon: FileText },
  { to: "/staff/approvals", label: "My Approvals", icon: CheckSquare },
  { to: "/staff/meetings", label: "Meetings & Agendas", icon: CalendarDays },
  { to: "/staff/briefings", label: "Meeting Briefings", icon: ClipboardList },
  { to: "/staff/console", label: "Meeting Console", icon: Gavel },
  { to: "/staff/comments", label: "Public Comment", icon: MessageSquare },
  { to: "/staff/records", label: "Records & FOIA", icon: Archive },
  { to: "/staff/audit", label: "Audit Trail", icon: ScrollText },
  { to: "/staff/security", label: "Account Security", icon: ShieldCheck },
  { to: "/staff/import", label: "Data Migration", icon: DatabaseZap },
  { to: "/staff/admin", label: "Administration", icon: Settings2 },
  { to: "/docs/clerk-handbook", label: "Clerk Handbook", icon: BookOpen },
] as const;

const MOBILE_TABS = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/staff/meetings", label: "Meetings", icon: CalendarDays },
  { to: "/staff/console", label: "Console", icon: Gavel },
  { to: "/staff/briefings", label: "Briefings", icon: ClipboardList },
];

export function StaffShell({ children }: { children: ReactNode }) {
  const { user, roles } = useSession();
  const { data: settings } = useSettings();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <aside aria-label="Staff navigation" className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <Link to="/" className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-5">
          <Landmark className="h-6 w-6 text-sidebar-primary" strokeWidth={1.5} />
          <span className="leading-tight">
            <span className="block font-display text-sm font-bold">
              {settings?.municipality_name ?? "CivicLedger"}
            </span>
            <span className="block text-[0.62rem] uppercase tracking-[0.16em] text-sidebar-foreground/60">
              Staff Portal
            </span>
          </span>
        </Link>
        <nav aria-label="Staff sections" className="flex-1 space-y-0.5 p-3">
          {NAV.map((n) => {
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                }`}
              >
                <n.icon className="h-4 w-4" strokeWidth={1.75} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-xs">
          <p className="truncate font-medium">{user?.email}</p>
          <p className="mt-0.5 text-sidebar-foreground/60">
            {roles.map((r) => ROLE_LABELS[r]).join(", ") || "No role assigned"}
          </p>
          <button
            onClick={signOut}
            className="mt-3 inline-flex items-center gap-1.5 rounded-sm border border-sidebar-border px-2.5 py-1.5 text-xs transition-colors hover:bg-sidebar-accent"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-card px-4 py-2 lg:hidden">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="whitespace-nowrap rounded-sm px-2.5 py-1.5 text-xs font-medium text-muted-foreground [&.active]:bg-accent [&.active]:text-accent-foreground"
            >
              {n.label}
            </Link>
          ))}
          <button onClick={signOut} className="ml-auto whitespace-nowrap text-xs text-seal">
            Sign out
          </button>
        </div>
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}

export function StaffHeader({
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
    <div className="border-b border-border bg-card px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="mt-1.5 font-display text-2xl font-bold text-foreground">{title}</h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
    </div>
  );
}
