import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function embedHead(title: string, description: string) {
  return {
    meta: [
      { title: `${title} — CivicLedger` },
      { name: "description", content: description },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}

export function EmbedFrame({ title, children }: { title: string; children: ReactNode }) {
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("municipality_name")
        .eq("id", 1)
        .maybeSingle();
      return data;
    },
  });

  return (
    <div className="bg-background p-4 text-foreground">
      <header className="mb-3 border-b border-border pb-2">
        <p className="text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
          {settings.data?.municipality_name ?? "CivicLedger"}
        </p>
        <h1 className="font-display text-lg">{title}</h1>
      </header>
      {children}
      <footer className="mt-4 border-t border-border pt-2 text-xs text-muted-foreground">
        <a href="/" target="_top" className="underline-offset-2 hover:underline">
          View the full public portal
        </a>
      </footer>
    </div>
  );
}
