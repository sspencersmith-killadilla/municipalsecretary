import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getClerkReports } from "@/lib/reports.functions";
import { StaffShell, StaffHeader } from "@/components/StaffShell";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/staff/reports")({
  head: () => ({
    meta: [
      { title: "Clerk Reports — CivicLedger Staff" },
      {
        name: "description",
        content:
          "Attendance, voting records, legislative turnaround and records-request performance for council reporting.",
      },
      { property: "og:title", content: "Clerk Reports" },
      {
        property: "og:description",
        content: "Attendance, votes, turnaround and FOIA performance in one place.",
      },
    ],
  }),
  component: Reports;
});

function download(name: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-sm border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="font-display text-base">{title}</h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function CsvButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-sm border border-border px-3 py-1 text-xs font-medium hover:bg-accent"
    >
      Export CSV
    </button>
  );
}

function Reports() {
  const { canManage } = useSession();
  const [months, setMonths] = useState(12);
  const fetchReports = useServerFn(getClerkReports);

  const reports = useQuery({
    queryKey: ["clerk-reports", months],
    enabled: canManage,
    queryFn: () => fetchReports({ data: { months } }),
  });

  const data = reports.data;

  return (
    <StaffShell>
      <StaffHeader
        eyebrow="Reporting"
        title="Clerk reports"
        description="Attendance, voting records, legislative turnaround and records-request performance."
      />
      <div className="space-y-6 p-6">
        {!canManage && (
          <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            Reports are limited to Clerk and Administrator accounts. Contact the Clerk's office if
            you need a copy for a meeting or budget packet.
          </div>
        )}

        {canManage && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="text-muted-foreground">Reporting period</label>
              <select
                className="rounded-sm border border-input bg-background px-3 py-1.5"
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
              >
                {[3, 6, 12, 24, 36].map((m) => (
                  <option key={m} value={m}>
                    Last {m} months
                  </option>
                ))}
              </select>
              {data && (
                <span className="text-muted-foreground">
                  {data.meetingCount} meetings · generated{" "}
                  {new Date(data.generatedAt).toLocaleString()}
                </span>
              )}
            </div>

            {reports.isLoading && <p className="text-sm text-muted-foreground">Compiling…</p>}
            {reports.isError && (
              <p className="text-sm text-destructive">{(reports.error as Error).message}</p>
            )}

            {data && (
              <div className="grid gap-6 xl:grid-cols-2">
                <Card
                  title="Attendance by member"
                  action={
                    <CsvButton
                      onClick={() =>
                        download("attendance.csv", [
                          ["Member", "Present", "Remote", "Excused", "Absent", "Meetings", "Rate %"],
                          ...data.attendance.map((r) => [
                            r.name,
                            r.present,
                            r.remote,
                            r.excused,
                            r.absent,
                            r.total,
                            r.rate,
                          ]),
                        ])
                      }
                    />
                  }
                >
                  <Table
                    head={["Member", "Present", "Remote", "Excused", "Absent", "Rate"]}
                    rows={data.attendance.map((r) => [
                      r.name,
                      r.present,
                      r.remote,
                      r.excused,
                      r.absent,
                      `${r.rate}%`,
                    ])}
                  />
                </Card>

                <Card
                  title="Voting record by member"
                  action={
                    <CsvButton
                      onClick={() =>
                        download("voting-record.csv", [
                          ["Member", "Aye", "Nay", "Abstain", "Recuse", "Votes cast", "Aye %"],
                          ...data.voting.map((r) => [
                            r.name,
                            r.aye,
                            r.nay,
                            r.abstain,
                            r.recuse,
                            r.cast,
                            r.ayeRate,
                          ]),
                        ])
                      }
                    />
                  }
                >
                  <Table
                    head={["Member", "Aye", "Nay", "Abstain", "Recuse", "Aye %"]}
                    rows={data.voting.map((r) => [
                      r.name,
                      r.aye,
                      r.nay,
                      r.abstain,
                      r.recuse,
                      `${r.ayeRate}%`,
                    ])}
                  />
                </Card>

                <Card title="Legislative turnaround">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Stat label="Adopted" value={data.turnaround.adoptedCount} />
                    <Stat label="Avg days to adopt" value={data.turnaround.averageDays} />
                    <Stat label="In draft" value={data.turnaround.draftCount} />
                    <Stat label="In review" value={data.turnaround.inReviewCount} />
                  </div>
                  <h3 className="mt-6 text-sm font-medium">Stalled over 30 days</h3>
                  <Table
                    head={["Item", "Body", "Status", "Days"]}
                    rows={data.stalled.map((r) => [
                      r.number ? `${r.number} — ${r.title}` : r.title,
                      r.body,
                      r.status.replace(/_/g, " "),
                      r.days,
                    ])}
                  />
                </Card>

                <Card
                  title="Records requests"
                  action={
                    <CsvButton
                      onClick={() =>
                        download("records-performance.csv", [
                          ["Metric", "Value"],
                          ["Total", data.records.total],
                          ["Open", data.records.open],
                          ["Closed", data.records.closed],
                          ["On-time rate %", data.records.onTimeRate],
                          ["Average days to close", data.records.averageDays],
                        ])
                      }
                    />
                  }
                >
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Stat label="Open" value={data.records.open} />
                    <Stat label="Closed" value={data.records.closed} />
                    <Stat label="On-time" value={`${data.records.onTimeRate}%`} />
                    <Stat label="Avg days" value={data.records.averageDays} />
                  </div>
                  {data.records.overdue.length > 0 && (
                    <>
                      <h3 className="mt-6 text-sm font-medium text-destructive">Overdue</h3>
                      <Table
                        head={["Tracking", "Status", "Days late"]}
                        rows={data.records.overdue.map((r) => [
                          r.tracking,
                          r.status.replace(/_/g, " "),
                          r.daysLate,
                        ])}
                      />
                    </>
                  )}
                </Card>

                <Card title="Meeting and agenda volume" >
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.volume}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="month" fontSize={11} />
                        <YAxis fontSize={11} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="meetings" name="Meetings" fill="hsl(var(--primary))" />
                        <Bar dataKey="items" name="Items filed" fill="hsl(var(--muted-foreground))" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </StaffShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-sm border border-border bg-background px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-2xl">{value}</p>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} className="py-2 pr-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td className="py-4 text-muted-foreground" colSpan={head.length}>
                Nothing to report for this period.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
