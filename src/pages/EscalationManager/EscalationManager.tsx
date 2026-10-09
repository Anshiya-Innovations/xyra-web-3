import EmptyState from "@/components/common/EmptyState";
import PageMeta from "@/components/common/PageMeta";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Tabs from "@/components/ui/tabs/Tabs";
import { notify } from "@/components/ui/toast/Toast";
import { formatTimestamp } from "@/components/xyra/AlertContext";
import {
  Card,
  CountTile,
  type DateRange,
  DateRangeField,
  ErrorBanner,
  Loading,
  type Option,
  PageHeader,
  SelectField,
  TableCard,
  TBODY,
  TD,
  TD_STRONG,
  TextField,
  TH,
  THEAD,
  XBadge,
} from "@/components/xyra/kit";
import {
  badgeColorFor,
  DECISION_BADGE_COLOR,
  DECISION_LABEL,
  ReviewReport,
  SlaBadge,
  slaLabel,
  terminalAt,
  terminalStatus,
} from "@/components/xyra/ReviewReport";
import { type ReviewEntry, type SystemEntry, reviewApi, systemConfigApi } from "@/lib/api-client";
import { cn } from "@/utils";
import { Download01, RefreshCw01, SearchLg } from "@untitledui/icons";
import { useEffect, useMemo, useState } from "react";

const ALL: Option = { value: "All", label: "All" };

function distinctOptions(values: string[]): Option[] {
  const seen = new Set<string>();
  const out: Option[] = [];
  values.forEach((v) => {
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push({ value: v, label: v });
    }
  });
  return out;
}

function toCsvCell(value: string): string {
  return `"${(value || "").replace(/"/g, '""')}"`;
}

export default function EscalationManager() {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [pending, setPending] = useState<ReviewEntry[]>([]);
  const [history, setHistory] = useState<ReviewEntry[]>([]);
  const [systems, setSystems] = useState<SystemEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pendingQuery, setPendingQuery] = useState("");
  const [pendingSystem, setPendingSystem] = useState("All");

  const [historyQuery, setHistoryQuery] = useState("");
  const [historySystem, setHistorySystem] = useState("All");
  const [historyDecision, setHistoryDecision] = useState("All");
  const [historyTicketStatus, setHistoryTicketStatus] = useState("All");
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  const [selected, setSelected] = useState<ReviewEntry | null>(null);

  const load = () => {
    setIsLoading(true);
    Promise.all([reviewApi.listLevel1Queue(), reviewApi.listLevel2Queue(), reviewApi.listLevel1History(), reviewApi.listLevel2History()])
      .then(([l1q, l2q, l1h, l2h]) => {
        if (!l1q.success || !l2q.success || !l1h.success || !l2h.success) {
          setError(l1q.message || l2q.message || l1h.message || l2h.message || "Could not load reviews.");
          return;
        }
        setError(null);
        setPending([...l1q.reviews, ...l2q.reviews]);
        setHistory([...l1h.reviews.filter((r) => r.reviewer1Status === "REMEDIATE"), ...l2h.reviews]);
      })
      .catch(() => setError("Could not reach the server. Is xyra-core running?"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
    systemConfigApi
      .list()
      .then((res) => res.success && setSystems(res.systems))
      .catch(() => {});
  }, []);

  const filteredPending = useMemo(() => {
    const q = pendingQuery.trim().toLowerCase();
    return pending.filter((r) => {
      if (q && !`${r.controlId} ${r.controlDescription} ${r.systemId}`.toLowerCase().includes(q)) return false;
      if (pendingSystem !== "All" && r.systemId !== pendingSystem) return false;
      return true;
    });
  }, [pending, pendingQuery, pendingSystem]);

  const pendingKpis = useMemo(() => ({ pending: pending.length, escalationsDue: pending.filter((r) => r.escalationDue).length }), [pending]);

  const historyTicketStatusOptions = useMemo(() => distinctOptions(history.map((r) => r.ticketStatus)), [history]);

  const filteredHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    const start = dateRange?.start;
    const end = dateRange?.end;
    return history.filter((r) => {
      if (q && !`${r.controlId} ${r.controlDescription} ${r.ticketNumber}`.toLowerCase().includes(q)) return false;
      if (historySystem !== "All" && r.systemId !== historySystem) return false;
      if (historyDecision !== "All" && (DECISION_LABEL[terminalStatus(r)] || "") !== historyDecision) return false;
      if (historyTicketStatus !== "All" && r.ticketStatus !== historyTicketStatus) return false;
      if (start || end) {
        const at = terminalAt(r);
        if (!at) return false;
        const d = new Date(at);
        if (isNaN(d.getTime())) return false;
        if (start && d < start) return false;
        if (end) {
          const endOfDay = new Date(end.getTime());
          endOfDay.setHours(23, 59, 59, 999);
          if (d > endOfDay) return false;
        }
      }
      return true;
    });
  }, [history, historyQuery, historySystem, historyDecision, historyTicketStatus, dateRange]);

  const historyKpis = useMemo(() => {
    let approved = 0;
    let rejected = 0;
    history.forEach((r) => {
      const status = terminalStatus(r);
      if (status === "APPROVE") approved++;
      else if (status === "REMEDIATE") rejected++;
    });
    return { approved, rejected, pending: pending.length };
  }, [history, pending]);

  const onResetPendingFilters = () => {
    setPendingQuery("");
    setPendingSystem("All");
  };
  const onResetHistoryFilters = () => {
    setHistoryQuery("");
    setHistorySystem("All");
    setHistoryDecision("All");
    setHistoryTicketStatus("All");
    setDateRange(null);
  };

  const onExportCsv = () => {
    if (filteredPending.length === 0) {
      notify("error", "No pending deviations available to export.");
      return;
    }
    const header = [
      "Control ID",
      "Description",
      "System",
      "Generated Date",
      "Severity",
      "Reviewer 1 Status",
      "Reviewer 2 Status",
      "Days Pending",
      "SLA",
      "Escalation Due",
    ].join(",");
    const rows = filteredPending.map((r) =>
      [
        toCsvCell(r.controlId),
        toCsvCell(r.controlDescription),
        toCsvCell(r.systemId),
        toCsvCell(r.generatedDate),
        toCsvCell(r.severity),
        toCsvCell(r.reviewer1Status),
        toCsvCell(r.reviewer2Status),
        toCsvCell(String(r.daysPending ?? "")),
        toCsvCell(slaLabel(r).text),
        toCsvCell(r.escalationDue ? "Yes" : "No"),
      ].join(","),
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `XYRA_Escalation_Monitoring_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify("success", "Monitoring report exported to CSV.");
  };

  if (isLoading) return <Loading label="Loading escalation overview…" />;

  if (selected) return <ReviewReport review={selected} parentLabel="Escalation Manager" onBack={() => setSelected(null)} />;

  const systemOptions = [ALL, ...distinctOptions(systems.map((s) => s.sysId))];

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title="Escalation Manager | Xyra" description="Review chain oversight" />
      <PageHeader
        crumbs={["Escalation Manager"]}
        title="Escalation Manager"
        description="Read-only oversight of the review chain — this persona has no decision of its own."
        actions={
          <Button variant="outline" size="sm" startIcon={<RefreshCw01 className="size-4" />} onClick={load}>
            Refresh
          </Button>
        }
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div>
        <Tabs
          selected={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: "pending", label: "Pending Deviations" },
            { id: "history", label: "Review History" },
          ]}
        />

        <div className="pt-6">
          {activeTab === "pending" && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4">
                <CountTile label="Pending Approval" value={pendingKpis.pending} />
                <CountTile
                  label="Escalations Due"
                  value={pendingKpis.escalationsDue}
                  color={pendingKpis.escalationsDue > 0 ? "error" : "success"}
                />
              </div>

              <Card
                title="Filters"
                actions={
                  <>
                    <Button variant="outline" size="sm" onClick={onResetPendingFilters}>
                      Reset
                    </Button>
                    <Button variant="outline" size="sm" startIcon={<Download01 className="size-4" />} onClick={onExportCsv}>
                      Export CSV
                    </Button>
                  </>
                }
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField label="Search" placeholder="Search Control ID, Description..." value={pendingQuery} onChange={setPendingQuery} />
                  <SelectField label="System" value={pendingSystem} onChange={setPendingSystem} options={systemOptions} />
                </div>
              </Card>

              {filteredPending.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
                  <EmptyState icon={SearchLg} title="Nothing pending" description="No deviations are currently awaiting review." />
                </div>
              ) : (
                <TableCard title="Pending Deviations" count={filteredPending.length}>
                  <Table>
                    <TableHeader className={THEAD}>
                      <TableRow>
                        {["Control ID", "System", "Stage", "Severity", "SLA", "Escalation", ""].map((h) => (
                          <TableCell key={h} isHeader className={TH}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody className={TBODY}>
                      {filteredPending.map((review) => (
                        <TableRow key={review.id} className={review.escalationDue ? "bg-error-50 dark:bg-error-500/10" : undefined}>
                          <TableCell className={TD}>
                            <div className="font-medium text-gray-800 dark:text-white/90">{review.controlId}</div>
                            <div className="text-theme-xs">{review.controlDescription}</div>
                          </TableCell>
                          <TableCell className={TD}>{review.systemId}</TableCell>
                          <TableCell className={TD}>{review.reviewer1Status === "NEW" ? "Level 1" : "Level 2"}</TableCell>
                          <TableCell className={TD}>
                            <XBadge color={badgeColorFor(review.severity)}>{review.severity}</XBadge>
                          </TableCell>
                          <TableCell className={TD}>
                            <SlaBadge review={review} />
                          </TableCell>
                          <TableCell className={TD}>{review.escalationDue && <XBadge color="error">Escalation Due</XBadge>}</TableCell>
                          <TableCell className={TD}>
                            <div className="flex justify-end">
                              <Button variant="outline" size="sm" className="px-3! py-2!" onClick={() => setSelected(review)}>
                                View Report
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableCard>
              )}
            </div>
          )}

          {activeTab === "history" && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <CountTile label="Approved & Closed Audits" value={historyKpis.approved} color="success" />
                <CountTile label="Rejected / Ticketed" value={historyKpis.rejected} color="error" />
                <CountTile label="Pending Review (L1 & L2)" value={historyKpis.pending} color="brand" />
              </div>

              <Card
                title="Filters"
                actions={
                  <Button variant="outline" size="sm" onClick={onResetHistoryFilters}>
                    Reset
                  </Button>
                }
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  <TextField label="Search" placeholder="Search Control ID, Ticket..." value={historyQuery} onChange={setHistoryQuery} />
                  <SelectField label="System" value={historySystem} onChange={setHistorySystem} options={systemOptions} />
                  <SelectField
                    label="Decision"
                    value={historyDecision}
                    onChange={setHistoryDecision}
                    options={[ALL, { value: "Approved", label: "Approved" }, { value: "Rejected", label: "Rejected" }]}
                  />
                  <SelectField label="Ticket Status" value={historyTicketStatus} onChange={setHistoryTicketStatus} options={[ALL, ...historyTicketStatusOptions]} />
                  <DateRangeField className="sm:col-span-2" label="Date Range" value={dateRange} onChange={setDateRange} />
                </div>
              </Card>

              {filteredHistory.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
                  <EmptyState icon={SearchLg} title="No history yet" description="No reviews have reached a final outcome yet." />
                </div>
              ) : (
                <TableCard title="Review History" count={filteredHistory.length}>
                  <Table>
                    <TableHeader className={THEAD}>
                      <TableRow>
                        {["Ticket", "Control ID", "System", "Decision", "Decided Date", "Ticket Status", ""].map((h) => (
                          <TableCell key={h} isHeader className={TH}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody className={TBODY}>
                      {filteredHistory.map((review) => {
                        const status = terminalStatus(review);
                        return (
                          <TableRow key={review.id}>
                            <TableCell className={TD}>
                              {review.ticketUrl ? (
                                <a
                                  href={review.ticketUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-medium text-brand-500 hover:underline dark:text-brand-400"
                                >
                                  {review.ticketNumber}
                                </a>
                              ) : (
                                <span className="text-gray-800 dark:text-white/90">{review.ticketNumber || "—"}</span>
                              )}
                            </TableCell>
                            <TableCell className={TD_STRONG}>{review.controlId}</TableCell>
                            <TableCell className={TD}>{review.systemId}</TableCell>
                            <TableCell className={TD}>
                              <XBadge color={DECISION_BADGE_COLOR[status] ?? "gray"}>{DECISION_LABEL[status] || status}</XBadge>
                            </TableCell>
                            <TableCell className={cn(TD, "whitespace-nowrap")}>{formatTimestamp(terminalAt(review))}</TableCell>
                            <TableCell className={TD}>{review.ticketStatus || "—"}</TableCell>
                            <TableCell className={TD}>
                              <div className="flex justify-end">
                                <Button variant="outline" size="sm" className="px-3! py-2!" onClick={() => setSelected(review)}>
                                  View Details
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableCard>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
