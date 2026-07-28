import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const RESTRICTED = ["draft", "in_review", "withdrawn"];

/**
 * Public link resolver for supporting documents attached to a legislative file.
 * Files live in a private bucket; this returns a short-lived signed URL only when
 * the parent record has left draft/review status (i.e. it is part of the public record).
 */
export const getAttachmentLink = createServerFn({ method: "POST" })
  .inputValidator((input: { attachmentId: string }) => {
    if (!input?.attachmentId || typeof input.attachmentId !== "string") {
      throw new Error("attachmentId is required");
    }
    return { attachmentId: input.attachmentId };
  })
  .handler(async ({ data }) => {
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const url = process.env.SUPABASE_URL!;
    const publicClient = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: att, error } = await publicClient
      .from("item_attachments")
      .select("id, storage_path, file_name, item_id, legislative_items(status)")
      .eq("id", data.attachmentId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!att) throw new Error("Attachment not found");

    const status = (att.legislative_items as { status?: string } | null)?.status;
    if (!status || RESTRICTED.includes(status)) {
      throw new Error("This document is not yet part of the public record.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const signed = await supabaseAdmin.storage
      .from("records")
      .createSignedUrl(att.storage_path, 300, { download: att.file_name });
    if (signed.error) throw new Error(signed.error.message);

    return { url: signed.data.signedUrl, fileName: att.file_name };
  });
