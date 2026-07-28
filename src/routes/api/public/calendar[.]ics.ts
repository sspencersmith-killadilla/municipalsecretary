import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function icsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(text: string) {
  return text.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

export const Route = createFileRoute("/api/public/calendar.ics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const supabase = publicClient();
        const { data, error } = await supabase
          .from("meetings")
          .select("id,title,starts_at,location,status,meeting_kind,cancelled_at, bodies(name)")
          .in("status", ["published", "in_progress", "adjourned", "cancelled"])
          .order("starts_at", { ascending: true })
          .limit(200);
        if (error) return new Response("Unable to build calendar", { status: 500 });

        const origin = new URL(request.url).origin;
        const lines = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//CivicLedger//Public Meetings//EN",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          "X-WR-CALNAME:Public Meetings",
        ];
        for (const m of data ?? []) {
          const body = (m.bodies as { name: string } | null)?.name ?? "Public body";
          const end = new Date(new Date(m.starts_at).getTime() + 2 * 60 * 60 * 1000).toISOString();
          lines.push(
            "BEGIN:VEVENT",
            `UID:${m.id}@civicledger`,
            `DTSTAMP:${icsDate(new Date().toISOString())}`,
            `DTSTART:${icsDate(m.starts_at)}`,
            `DTEND:${icsDate(end)}`,
            `SUMMARY:${esc(`${body} — ${m.title}`)}`,
            `LOCATION:${esc(m.location ?? "See notice")}`,
            `URL:${origin}/meetings/${m.id}`,
            `DESCRIPTION:${esc(`${m.meeting_kind ?? "regular"} meeting. Agenda: ${origin}/meetings/${m.id}`)}`,
            `STATUS:${m.cancelled_at ? "CANCELLED" : "CONFIRMED"}`,
            "END:VEVENT",
          );
        }
        lines.push("END:VCALENDAR");

        return new Response(lines.join("\r\n"), {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'inline; filename="public-meetings.ics"',
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
