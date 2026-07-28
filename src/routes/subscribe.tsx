import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PublicLayout, PageHeader } from "@/components/PublicLayout";

export const Route = createFileRoute("/subscribe")({
  head: () => ({
    meta: [
      { title: "Subscribe to Meeting Notices — Public Legislative Portal" },
      {
        name: "description",
        content:
          "Get email alerts when agendas are posted, meetings change or minutes are published, and subscribe by calendar or RSS feed.",
      },
      { property: "og:title", content: "Subscribe to Meeting Notices" },
      {
        property: "og:description",
        content: "Email, calendar and RSS alerts for agendas, changes and minutes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Subscribe,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(320),
});

function Subscribe() {
  const [email, setEmail] = useState("");
  const [bodyId, setBodyId] = useState("");

  const bodies = useQuery({
    queryKey: ["public", "bodies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bodies")
        .select("id,name,slug")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const subscribe = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ email });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const { error } = await supabase.from("subscriptions").insert({
        email: parsed.data.email,
        body_id: bodyId || null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("That address is already subscribed.");
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Subscribed. You'll receive notices for the selected body.");
      setEmail("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Stay informed"
        title="Subscribe to meeting notices"
        description="Choose a board or council and we'll notify you when an agenda is posted, a meeting is changed or cancelled, and when minutes are published."
      />
      <div className="mx-auto grid max-w-4xl gap-8 px-5 py-12 md:grid-cols-2">
        <form
          className="paper space-y-3 rounded-sm p-6"
          onSubmit={(e) => {
            e.preventDefault();
            subscribe.mutate();
          }}
        >
          <h2 className="font-display text-lg font-bold">Email alerts</h2>
          <label className="block text-xs">
            <span className="eyebrow">Email address *</span>
            <input
              type="email"
              required
              maxLength={320}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="eyebrow">Body</span>
            <select
              value={bodyId}
              onChange={(e) => setBodyId(e.target.value)}
              className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
            >
              <option value="">All boards and councils</option>
              {(bodies.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={subscribe.isPending}
            className="rounded-sm bg-seal px-4 py-2 text-sm font-semibold text-seal-foreground disabled:opacity-50"
          >
            Subscribe
          </button>
          <p className="text-[0.7rem] text-muted-foreground">
            Your address is used only to send meeting notices and is not published.
          </p>
        </form>

        <div className="space-y-4">
          <div className="paper rounded-sm p-6">
            <h2 className="font-display text-lg font-bold">Calendar feed</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Subscribe in Outlook, Google Calendar or Apple Calendar with this address:
            </p>
            <code className="mt-2 block break-all rounded-sm bg-secondary px-3 py-2 text-xs">
              /api/public/calendar.ics
            </code>
            <a
              href="/api/public/calendar.ics"
              className="mt-3 inline-block text-sm font-semibold text-seal hover:underline"
            >
              Download .ics
            </a>
          </div>
          <div className="paper rounded-sm p-6">
            <h2 className="font-display text-lg font-bold">RSS feed</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Newly posted agendas and adopted legislation, as a standard feed.
            </p>
            <a
              href="/api/public/rss.xml"
              className="mt-3 inline-block text-sm font-semibold text-seal hover:underline"
            >
              Open RSS feed
            </a>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
