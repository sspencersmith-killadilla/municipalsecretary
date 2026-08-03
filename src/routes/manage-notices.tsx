import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  confirmSubscription,
  getSubscription,
  unsubscribeFromNotices,
  updateSubscriptionPreferences,
} from "@/lib/notifications.functions";
import { PublicLayout, PageHeader } from "@/components/PublicLayout";

const search = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/manage-notices")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Manage Your Meeting Notices — Public Legislative Portal" },
      {
        name: "description",
        content:
          "Confirm your subscription, choose which meeting notices you receive, or unsubscribe at any time.",
      },
      { property: "og:title", content: "Manage Your Meeting Notices" },
      {
        property: "og:description",
        content: "Confirm, adjust or cancel your email notices for agendas, changes and minutes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManageNotices,
});

function ManageNotices() {
  const { token } = Route.useSearch();
  const load = useServerFn(getSubscription);
  const confirm = useServerFn(confirmSubscription);
  const update = useServerFn(updateSubscriptionPreferences);
  const unsubscribe = useServerFn(unsubscribeFromNotices);

  const subscription = useQuery({
    queryKey: ["subscription", token],
    enabled: !!token,
    queryFn: () => load({ data: { token: token! } }),
  });

  const [prefs, setPrefs] = useState<{
    agendas: boolean;
    minutes: boolean;
    changes: boolean;
  } | null>(null);

  const current = prefs ?? {
    agendas: subscription.data?.notifyAgendas ?? true,
    minutes: subscription.data?.notifyMinutes ?? true,
    changes: subscription.data?.notifyChanges ?? true,
  };

  const confirmMutation = useMutation({
    mutationFn: () => confirm({ data: { token: token! } }),
    onSuccess: () => {
      toast.success("Subscription confirmed");
      subscription.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      update({
        data: {
          token: token!,
          notifyAgendas: current.agendas,
          notifyMinutes: current.minutes,
          notifyChanges: current.changes,
        },
      }),
    onSuccess: () => toast.success("Preferences saved"),
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => unsubscribe({ data: { token: token! } }),
    onSuccess: () => {
      toast.success("You have been unsubscribed");
      subscription.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PublicLayout>
      <PageHeader
        eyebrow="Notices"
        title="Manage your meeting notices"
        description="Confirm your subscription, choose what you receive, or unsubscribe."
      />
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        {!token && (
          <p className="rounded-sm border border-border bg-card p-6 text-sm text-muted-foreground">
            This page needs the personal link from your confirmation email.
          </p>
        )}

        {token && subscription.isLoading && (
          <p className="text-sm text-muted-foreground">Loading your subscription…</p>
        )}

        {token && subscription.isError && (
          <p className="rounded-sm border border-destructive/40 bg-destructive/5 p-6 text-sm">
            That link is no longer valid. You can sign up again from the subscribe page.
          </p>
        )}

        {token && subscription.data && (
          <div className="space-y-6">
            <div className="rounded-sm border border-border bg-card p-6">
              <p className="font-display text-lg">{subscription.data.email}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {subscription.data.bodyName
                  ? `Notices for ${subscription.data.bodyName}`
                  : "Notices for every public body"}
              </p>
              <p className="mt-3 text-sm">
                Status:{" "}
                <span className="font-medium">
                  {subscription.data.unsubscribed
                    ? "Unsubscribed"
                    : subscription.data.confirmed
                      ? "Confirmed"
                      : "Awaiting confirmation"}
                </span>
              </p>
              {!subscription.data.confirmed && (
                <button
                  className="mt-4 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                  onClick={() => confirmMutation.mutate()}
                  disabled={confirmMutation.isPending}
                >
                  Confirm my subscription
                </button>
              )}
            </div>

            <div className="rounded-sm border border-border bg-card p-6">
              <h2 className="font-display text-lg">What you receive</h2>
              <div className="mt-4 space-y-3 text-sm">
                {(
                  [
                    ["agendas", "Agendas when they are posted"],
                    ["changes", "Amendments, continuations and cancellations"],
                    ["minutes", "Minutes when they are published"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={current[key]}
                      onChange={(e) => setPrefs({ ...current, [key]: e.target.checked })}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  Save preferences
                </button>
                <button
                  className="rounded-sm border border-border px-4 py-2 text-sm font-medium"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                >
                  Unsubscribe from everything
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
