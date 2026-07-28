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

function xml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const Route = createFileRoute("/api/public/rss.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const supabase = publicClient();

        const [meetings, items] = await Promise.all([
          supabase
            .from("meetings")
            .select("id,title,starts_at,published_at,location, bodies(name)")
            .not("published_at", "is", null)
            .order("published_at", { ascending: false })
            .limit(25),
          supabase
            .from("legislative_items")
            .select("id,title,assigned_number,summary,adopted_at,updated_at")
            .in("status", ["adopted", "failed"])
            .order("updated_at", { ascending: false })
            .limit(25),
        ]);

        const entries = [
          ...(meetings.data ?? []).map((m) => ({
            title: `Agenda posted — ${(m.bodies as { name: string } | null)?.name ?? "Public body"}: ${m.title}`,
            link: `${origin}/meetings/${m.id}`,
            date: m.published_at ?? m.starts_at,
            description: `Meeting ${new Date(m.starts_at).toLocaleString("en-US")} at ${m.location ?? "see notice"}.`,
          })),
          ...(items.data ?? []).map((i) => ({
            title: `${i.assigned_number ? `${i.assigned_number} — ` : ""}${i.title}`,
            link: `${origin}/legislation/${i.id}`,
            date: i.adopted_at ?? i.updated_at,
            description: i.summary ?? "Legislative file update.",
          })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Public Legislative Notices</title>
<link>${origin}</link>
<description>Posted agendas and adopted legislation.</description>
${entries
  .map(
    (e) => `<item>
<title>${xml(e.title)}</title>
<link>${xml(e.link)}</link>
<guid isPermaLink="true">${xml(e.link)}</guid>
<pubDate>${new Date(e.date).toUTCString()}</pubDate>
<description>${xml(e.description)}</description>
</item>`,
  )
  .join("\n")}
</channel></rss>`;

        return new Response(body, {
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
