import { createServerFn } from "@tanstack/react-start";

/**
 * Public records-request intake and tracking.
 *
 * The underlying database functions are SECURITY DEFINER and are no longer
 * executable by anonymous or signed-in Data API clients. All public access is
 * funnelled through these server functions, which validate and normalise input
 * before invoking them with the trusted server client.
 */

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export const fileRecordsRequest = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      requester_name: string;
      description: string;
      requester_email?: string;
      requester_phone?: string;
    }) => {
      const requester_name = clean(input?.requester_name, 200);
      const description = clean(input?.description, 8000);
      const requester_email = clean(input?.requester_email, 320);
      const requester_phone = clean(input?.requester_phone, 40);
      if (!requester_name) throw new Error("A name is required.");
      if (!description) throw new Error("A description of the records is required.");
      if (requester_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requester_email)) {
        throw new Error("Enter a valid email address.");
      }
      return { requester_name, description, requester_email, requester_phone };
    },
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("file_records_request", {
      _requester_name: data.requester_name,
      _description: data.description,
      _requester_email: data.requester_email || undefined,
      _requester_phone: data.requester_phone || undefined,
    });
    if (error) {
      console.error("[records] file_records_request failed", error);
      throw new Error("Your request could not be filed. Please try again.");
    }
    const row = (rows ?? [])[0];
    if (!row) throw new Error("Your request could not be filed. Please try again.");
    return row;
  });

export const lookupRecordsRequest = createServerFn({ method: "POST" })
  .inputValidator((input: { tracking_code: string }) => {
    const tracking_code = clean(input?.tracking_code, 64);
    if (!tracking_code) throw new Error("Enter a tracking code.");
    return { tracking_code };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("lookup_records_request", {
      _tracking_code: data.tracking_code,
    });
    if (error) {
      console.error("[records] lookup_records_request failed", error);
      throw new Error("Lookup is unavailable right now. Please try again.");
    }
    const row = (rows ?? [])[0];
    if (!row) return null;
    // Return only the fields the requester needs; never echo stored contact details.
    return {
      tracking_code: row.tracking_code,
      description: row.description,
      status: row.status,
      received_at: row.received_at,
      due_at: row.due_at,
      closed_at: row.closed_at,
      response_note: row.response_note,
    };
  });
