import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const schema = z.object({
  full_name: z.string().trim().min(1, "Enter your name").max(200),
  email: z.string().trim().email("Enter a valid email").max(255).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  organization: z.string().trim().max(200).optional().or(z.literal("")),
  body: z.string().trim().min(1, "Enter your comment").max(8000),
});

export function PublicCommentForm({
  meetingId,
  agendaItems,
  open,
  deadline,
}: {
  meetingId: string;
  agendaItems: { id: string; title: string; display_number: string | null }[];
  open: boolean;
  deadline: string | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    address: "",
    organization: "",
    body: "",
  });
  const [agendaItemId, setAgendaItemId] = useState("");
  const [commentType, setCommentType] = useState<"written" | "speak">("written");
  const [position, setPosition] = useState<"support" | "oppose" | "neutral">("neutral");

  const closed = !open || (deadline ? new Date(deadline) < new Date() : false);

  const submit = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const { error } = await supabase.from("public_comments").insert({
        meeting_id: meetingId,
        agenda_item_id: agendaItemId || null,
        full_name: parsed.data.full_name,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        organization: parsed.data.organization || null,
        comment_type: commentType,
        position,
        body: parsed.data.body,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comment received — it will appear once the Clerk reviews it.");
      setForm({ full_name: "", email: "", address: "", organization: "", body: "" });
      qc.invalidateQueries({ queryKey: ["public", "comments", meetingId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (closed) {
    return (
      <p className="paper rounded-sm p-5 text-sm text-muted-foreground">
        Online public comment for this meeting is closed. You may still address the body in person
        during the public comment period.
      </p>
    );
  }

  return (
    <form
      className="paper space-y-3 rounded-sm p-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="eyebrow">Your name *</span>
          <input
            required
            maxLength={200}
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="eyebrow">Email</span>
          <input
            type="email"
            maxLength={255}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="eyebrow">Address (optional)</span>
          <input
            maxLength={300}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="eyebrow">Organization (optional)</span>
          <input
            maxLength={200}
            value={form.organization}
            onChange={(e) => setForm({ ...form, organization: e.target.value })}
            className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="eyebrow">Agenda item</span>
          <select
            value={agendaItemId}
            onChange={(e) => setAgendaItemId(e.target.value)}
            className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
          >
            <option value="">General public comment</option>
            {agendaItems.map((a) => (
              <option key={a.id} value={a.id}>
                {a.display_number ? `${a.display_number}. ` : ""}
                {a.title}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs">
            <span className="eyebrow">Type</span>
            <select
              value={commentType}
              onChange={(e) => setCommentType(e.target.value as "written" | "speak")}
              className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
            >
              <option value="written">Written only</option>
              <option value="speak">I wish to speak</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="eyebrow">Position</span>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as "support" | "oppose" | "neutral")}
              className="mt-1 w-full rounded-sm border border-input bg-background px-2.5 py-2 text-sm"
            >
              <option value="neutral">Neutral</option>
              <option value="support">Support</option>
              <option value="oppose">Oppose</option>
            </select>
          </label>
        </div>
      </div>
      <label className="block text-xs">
        <span className="eyebrow">Comment *</span>
        <textarea
          required
          rows={5}
          maxLength={8000}
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          className="mt-1 w-full rounded-sm border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      <p className="text-[0.7rem] text-muted-foreground">
        Comment cards become part of the public record and may be published with your name.
      </p>
      <button
        type="submit"
        disabled={submit.isPending}
        className="rounded-sm bg-seal px-4 py-2 text-sm font-semibold text-seal-foreground disabled:opacity-50"
      >
        Submit comment
      </button>
    </form>
  );
}

export function ApprovedComments({ meetingId }: { meetingId: string }) {
  const comments = useQuery({
    queryKey: ["public", "comments", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_comments")
        .select("id,full_name,position,comment_type,body,created_at,agenda_item_id")
        .eq("meeting_id", meetingId)
        .eq("status", "approved")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = comments.data ?? [];
  if (rows.length === 0) return null;

  return (
    <ul className="space-y-3">
      {rows.map((c) => (
        <li key={c.id} className="paper rounded-sm p-4">
          <p className="text-sm font-medium text-foreground">
            {c.full_name}
            
          </p>
          <p className="docnum text-xs uppercase text-muted-foreground">
            {c.position} · {c.comment_type === "speak" ? "wished to speak" : "written"}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{c.body}</p>
        </li>
      ))}
    </ul>
  );
}
