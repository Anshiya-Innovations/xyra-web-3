import EmptyState from "@/components/common/EmptyState";
import PageMeta from "@/components/common/PageMeta";
import Checkbox from "@/components/form/input/Checkbox";
import Button from "@/components/ui/button/Button";
import Pagination from "@/components/ui/pagination/Pagination";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableSortHeader } from "@/components/ui/table";
import Tabs from "@/components/ui/tabs/Tabs";
import { notify } from "@/components/ui/toast/Toast";
import { AlertContext, formatTimestamp } from "@/components/xyra/AlertContext";
import {
  Card,
  CountTile,
  type DateRange,
  DateRangeField,
  DetailItem,
  Dialog,
  ErrorBanner,
  InfoBanner,
  Loading,
  type Option,
  PageHeader,
  SelectField,
  TableCard,
  TBODY,
  TD,
  TD_STRONG,
  TextAreaField,
  TextField,
  TH,
  THEAD,
  XBadge,
} from "@/components/xyra/kit";
import { badgeColorFor, DECISION_BADGE_COLOR, DECISION_LABEL, SLA_BUCKETS, SlaBadge, slaBucket } from "@/components/xyra/ReviewReport";
import { severityRank, toTime, usePagination, useTableSort } from "@/hooks/use-table-sort";
import { type ReviewEntry, type SystemEntry, auditLogApi, reviewApi, systemConfigApi } from "@/lib/api-client";
import { REVIEWER_CONFIG, type ReviewerLevelConfig } from "@/lib/reviewer-config";
import { getSession } from "@/lib/session";
import { cn } from "@/utils";
import { RefreshCw01, SearchLg } from "@untitledui/icons";
import { useEffect, useMemo, useState } from "react";

const ALL: Option = { value: "All", label: "All" };
const SEVERITY_OPTIONS: Option[] = [ALL, ...["Critical", "High", "Medium", "Low"].map((v) => ({ value: v, label: v }))];

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

function statusFieldFor(review: ReviewEntry, level: 1 | 2): ReviewEntry["reviewer1Status"] {
  return level === 1 ? review.reviewer1Status : review.reviewer2Status;
}
function commentFieldFor(review: ReviewEntry, level: 1 | 2): string {
  return level === 1 ? review.reviewer1Comment : review.reviewer2Comment;
}
function atFieldFor(review: ReviewEntry, level: 1 | 2): string | null {
  return level === 1 ? review.reviewer1At : review.reviewer2At;
}

export default function ReviewerQueue({ level }: { level: 1 | 2 }) {
  const config: ReviewerLevelConfig = REVIEWER_CONFIG[level];
  const session = getSession();

  const [activeTab, setActiveTab] = useState<"queue" | "history">("queue");
  const [queue, setQueue] = useState<ReviewEntry[]>([]);
  const [history, setHistory] = useState<ReviewEntry[]>([]);
  const [systems, setSystems] = useState<SystemEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [queueQuery, setQueueQuery] = useState("");
  const [queueSystem, setQueueSystem] = useState("All");
  const [queueSla, setQueueSla] = useState("All");
  const [queueSeverity, setQueueSeverity] = useState("All");

  const [historyQuery, setHistoryQuery] = useState("");
  const [historyControlId, setHistoryControlId] = useState("");
  const [historySystem, setHistorySystem] = useState("All");
  const [historyDecision, setHistoryDecision] = useState("All");
  const [historyTicketStatus, setHistoryTicketStatus] = useState("All");
  const [historySeverity, setHistorySeverity] = useState("All");
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  const [selectedReview, setSelectedReview] = useState<ReviewEntry | null>(null);
  const [rcaText, setRcaText] = useState("");
  const [elecSigConfirmed, setElecSigConfirmed] = useState(false);

  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isDeciding, setIsDeciding] = useState(false);

  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ReviewEntry | null>(null);

  const load = () => {
    setIsLoading(true);
    const listQueue = level === 1 ? reviewApi.listLevel1Queue : reviewApi.listLevel2Queue;
    const listHistory = level === 1 ? reviewApi.listLevel1History : reviewApi.listLevel2History;
    Promise.all([listQueue(), listHistory()])
      .then(([queueRes, historyRes]) => {
        if (!queueRes.success || !historyRes.success) {
          setError(queueRes.message || historyRes.message || "Could not load reviews.");
          return;
        }
        setError(null);
        setQueue(queueRes.reviews);
        setHistory(historyRes.reviews);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  const filteredQueue = useMemo(() => {
    const q = queueQuery.trim().toLowerCase();
    return queue.filter((r) => {
      if (q && !`${r.controlId} ${r.controlDescription} ${r.systemId}`.toLowerCase().includes(q)) return false;
      if (queueSystem !== "All" && r.systemId !== queueSystem) return false;
      if (queueSla !== "All" && slaBucket(r) !== queueSla) return false;
      if (queueSeverity !== "All" && (r.severity || "").toLowerCase() !== queueSeverity.toLowerCase()) return false;
      return true;
    });
  }, [queue, queueQuery, queueSystem, queueSla, queueSeverity]);

  const queueKpis = useMemo(() => ({ pending: queue.length, overdue: queue.filter((r) => r.isOverdue).length }), [queue]);

  const historyTicketStatusOptions = useMemo(() => distinctOptions(history.map((r) => r.ticketStatus)), [history]);

  const filteredHistory = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    const cid = historyControlId.trim().toLowerCase();
    const start = dateRange?.start;
    const end = dateRange?.end;
    return history.filter((r) => {
      if (q && !`${r.controlId} ${r.controlDescription} ${r.ticketNumber}`.toLowerCase().includes(q)) return false;
      if (cid && !r.controlId.toLowerCase().includes(cid)) return false;
      if (historySystem !== "All" && r.systemId !== historySystem) return false;
      if (historyDecision !== "All") {
        const decision = DECISION_LABEL[statusFieldFor(r, level)] || "";
        if (decision !== historyDecision) return false;
      }
      if (historyTicketStatus !== "All" && r.ticketStatus !== historyTicketStatus) return false;
      if (historySeverity !== "All" && (r.severity || "").toLowerCase() !== historySeverity.toLowerCase()) return false;
      if (start || end) {
        const at = atFieldFor(r, level);
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
  }, [history, historyQuery, historyControlId, historySystem, historyDecision, historyTicketStatus, historySeverity, dateRange, level]);

  const queueSort = useTableSort(filteredQueue, {
    controlId: (r) => r.controlId,
    system: (r) => `${r.systemId}/${r.client}`,
    generatedDate: (r) => toTime(r.generatedDate),
    rev1Decision: (r) => DECISION_LABEL[r.reviewer1Status] || r.reviewer1Status,
    severity: (r) => severityRank(r.severity),
    sla: (r) => toTime(r.slaDeadline),
  });

  const historySort = useTableSort(filteredHistory, {
    ticket: (r) => r.ticketNumber,
    controlId: (r) => r.controlId,
    system: (r) => `${r.systemId}/${r.client}`,
    decision: (r) => DECISION_LABEL[statusFieldFor(r, level)] || statusFieldFor(r, level),
    reviewedDate: (r) => toTime(atFieldFor(r, level)),
    ticketStatus: (r) => r.ticketStatus,
    severity: (r) => severityRank(r.severity),
  });

  const queuePages = usePagination(queueSort.sorted);
  const historyPages = usePagination(historySort.sorted);

  const historyKpis = useMemo(() => {
    let approved = 0;
    let rejected = 0;
    history.forEach((r) => {
      const status = statusFieldFor(r, level);
      if (status === "APPROVE") approved++;
      else if (status === "REMEDIATE") rejected++;
    });
    return { approved, rejected, pending: queue.length };
  }, [history, queue, level]);

  const onResetQueueFilters = () => {
    setQueueQuery("");
    setQueueSystem("All");
    setQueueSla("All");
    setQueueSeverity("All");
  };

  const onResetHistoryFilters = () => {
    setHistoryQuery("");
    setHistoryControlId("");
    setHistorySystem("All");
    setHistoryDecision("All");
    setHistoryTicketStatus("All");
    setHistorySeverity("All");
    setDateRange(null);
  };

  const openDetail = (review: ReviewEntry) => {
    setSelectedReview(review);
    setRcaText(commentFieldFor(review, level) || "");
    setElecSigConfirmed(false);

    auditLogApi.logEvent({
      action: "VIEW_REPORT",
      module: "Review",
      objectType: "Report",
      objectId: review.id,
      objectLabel: review.controlId,
      description: `Opened review for '${review.controlId}' on ${review.systemId}.`,
      systemId: review.systemId,
      controlId: review.controlId,
    });
  };

  const backToQueue = () => setSelectedReview(null);

  const canDecide = rcaText.trim().length > 0 && elecSigConfirmed;

  const onDecisionClick = (open: (v: boolean) => void) => {
    if (!canDecide) {
      notify("error", "Root Cause Analysis and Electronic Signature confirmation are required before deciding.");
      return;
    }
    open(true);
  };

  const decide = async (decision: "APPROVE" | "REMEDIATE") => {
    if (!selectedReview) return;
    setIsDeciding(true);
    try {
      const fn = level === 1 ? reviewApi.decideLevel1 : reviewApi.decideLevel2;
      const res = await fn(selectedReview.id, decision, rcaText.trim());
      if (!res.success) {
        notify("error", res.message || "Could not record this decision.");
        return;
      }
      if (decision === "APPROVE") {
        notify("success", `${selectedReview.controlId}: ${config.approveSuccessMessage}`);
      } else {
        notify("success", `${selectedReview.controlId}: rejected. Remediation ticket ${res.ticketNumber} created.`);
      }
      setIsApproveOpen(false);
      setIsRejectOpen(false);
      backToQueue();
      load();
    } catch {
      notify("error", "Could not reach the server. Is xyra-core running?");
    } finally {
      setIsDeciding(false);
    }
  };

  if (isLoading) return <Loading label="Loading review queue…" />;

  // DETAIL VIEW
  if (selectedReview) {
    return (
      <div className="flex flex-col gap-6">
        <PageMeta title={`${selectedReview.controlId} Review | Xyra`} description="Deviation review" />
        <PageHeader
          crumbs={[config.pageTitle, `${selectedReview.controlId} Review`]}
          onBack={backToQueue}
          title={`${selectedReview.controlId} on ${selectedReview.systemId}`}
          description={selectedReview.controlDescription}
          actions={<XBadge color={badgeColorFor(selectedReview.severity)}>{selectedReview.severity}</XBadge>}
        />

        {config.showReviewer1Summary && (
          <Card title="Reviewer 1 Review Summary">
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              <DetailItem label="Reviewer 1 Decision">
                {DECISION_LABEL[selectedReview.reviewer1Status] || selectedReview.reviewer1Status}
              </DetailItem>
              <DetailItem label="Reviewed By">{selectedReview.reviewer1ByName || "—"}</DetailItem>
              <DetailItem label="Review Date">{formatTimestamp(selectedReview.reviewer1At)}</DetailItem>
              <div className="col-span-2 lg:col-span-1">
                <DetailItem label="Reviewer 1 RCA">{selectedReview.reviewer1Comment || "—"}</DetailItem>
              </div>
            </div>
          </Card>
        )}

        <AlertContext alertId={selectedReview.alertId} />

        <Card title="Root Cause Analysis">
          <TextAreaField required rows={4} placeholder="Document root cause analysis for this decision..." value={rcaText} onChange={setRcaText} />
        </Card>

        <Card title="Electronic Signature & Attestation">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
            <DetailItem label="Reviewer">{session?.name || "—"}</DetailItem>
            <DetailItem label="Email">{session?.email || "—"}</DetailItem>
            <DetailItem label="Decision Date">{new Date().toLocaleDateString()}</DetailItem>
          </div>
          <div className="mt-5">
            <Checkbox
              checked={elecSigConfirmed}
              onChange={setElecSigConfirmed}
              label="I attest that this review reflects an accurate root cause analysis and I am authorized to record this decision."
            />
          </div>
        </Card>

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" size="sm" onClick={backToQueue}>
            Back to {config.queueTitle}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDecisionClick(setIsRejectOpen)}>
            Reject
          </Button>
          <Button size="sm" onClick={() => onDecisionClick(setIsApproveOpen)}>
            {config.approveLabel}
          </Button>
        </div>

        <Dialog
          open={isApproveOpen}
          onClose={() => setIsApproveOpen(false)}
          title={config.approveDialogTitle}
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setIsApproveOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" loading={isDeciding} onClick={() => decide("APPROVE")}>
                {config.approveLabel}
              </Button>
            </>
          }
        >
          <InfoBanner>{config.approveNote}</InfoBanner>
          <DecisionSummary review={selectedReview} rca={rcaText} showSystem />
        </Dialog>

        <Dialog
          open={isRejectOpen}
          onClose={() => setIsRejectOpen(false)}
          title={config.rejectDialogTitle}
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setIsRejectOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" loading={isDeciding} onClick={() => decide("REMEDIATE")}>
                Reject
              </Button>
            </>
          }
        >
          <ErrorBanner>Rejecting creates a remediation ticket immediately and ends this review chain.</ErrorBanner>
          <DecisionSummary review={selectedReview} rca={rcaText} />
        </Dialog>
      </div>
    );
  }

  // QUEUE / HISTORY VIEW
  const systemOptions = [ALL, ...distinctOptions(systems.map((s) => s.sysId))];
  const sortProps = (s: typeof queueSort) => ({ sort: s.sortDescriptor, onSortChange: s.onSortChange, className: TH });

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title={`${config.pageTitle} | Xyra`} description={config.pageSubtitle} />
      <PageHeader
        crumbs={[config.pageTitle]}
        title={config.pageTitle}
        description={config.pageSubtitle}
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
            { id: "queue", label: config.queueTitle },
            { id: "history", label: "Reviewer History" },
          ]}
        />

        <div className="pt-6">
          {activeTab === "queue" && (
            <div className="flex flex-col gap-6">
              <Card
                title="Filters"
                actions={
                  <Button variant="outline" size="sm" onClick={onResetQueueFilters}>
                    Reset
                  </Button>
                }
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <TextField label="Search" placeholder="Search Control ID, Description..." value={queueQuery} onChange={setQueueQuery} />
                  <SelectField label="SLA" value={queueSla} onChange={setQueueSla} options={[ALL, ...SLA_BUCKETS.map((b) => ({ value: b, label: b }))]} />
                  <SelectField label="Severity" value={queueSeverity} onChange={setQueueSeverity} options={SEVERITY_OPTIONS} />
                  <SelectField label="System" value={queueSystem} onChange={setQueueSystem} options={systemOptions} />
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <CountTile label="Pending" value={queueKpis.pending} />
                <CountTile label="Overdue" value={queueKpis.overdue} color={queueKpis.overdue > 0 ? "error" : "success"} />
              </div>

              {filteredQueue.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
                  <EmptyState icon={SearchLg} title="Nothing pending" description="No reviews are currently waiting at this stage." />
                </div>
              ) : (
                <TableCard
                  title={config.queueTitle}
                  count={filteredQueue.length}
                  footer={<Pagination page={queuePages.page} total={queuePages.total} onPageChange={queuePages.setPage} />}
                >
                  <Table>
                    <TableHeader className={THEAD}>
                      <TableRow>
                        <TableSortHeader column="controlId" {...sortProps(queueSort)}>
                          Control ID
                        </TableSortHeader>
                        <TableSortHeader column="system" {...sortProps(queueSort)}>
                          System
                        </TableSortHeader>
                        <TableSortHeader column="generatedDate" {...sortProps(queueSort)}>
                          Generated Date
                        </TableSortHeader>
                        {config.showReviewer1Summary && (
                          <TableSortHeader column="rev1Decision" {...sortProps(queueSort)}>
                            Reviewer 1 Decision
                          </TableSortHeader>
                        )}
                        <TableSortHeader column="severity" {...sortProps(queueSort)}>
                          Severity
                        </TableSortHeader>
                        <TableSortHeader column="sla" {...sortProps(queueSort)}>
                          SLA
                        </TableSortHeader>
                        <TableCell isHeader className={TH}> </TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody className={TBODY}>
                      {queuePages.paged.map((review) => (
                        <TableRow key={review.id}>
                          <TableCell className={TD}>
                            <div className="font-medium text-gray-800 dark:text-white/90">{review.controlId}</div>
                            <div className="text-theme-xs">{review.controlDescription}</div>
                          </TableCell>
                          <TableCell className={TD}>{review.systemId}</TableCell>
                          <TableCell className={cn(TD, "whitespace-nowrap")}>{formatTimestamp(review.generatedDate)}</TableCell>
                          {config.showReviewer1Summary && (
                            <TableCell className={TD}>
                              <XBadge color={DECISION_BADGE_COLOR[review.reviewer1Status] ?? "gray"}>
                                {DECISION_LABEL[review.reviewer1Status] || review.reviewer1Status}
                              </XBadge>
                            </TableCell>
                          )}
                          <TableCell className={TD}>
                            <XBadge color={badgeColorFor(review.severity)}>{review.severity}</XBadge>
                          </TableCell>
                          <TableCell className={TD}>
                            <SlaBadge review={review} />
                          </TableCell>
                          <TableCell className={TD}>
                            <div className="flex justify-end">
                              <Button size="sm" className="px-3! py-2!" onClick={() => openDetail(review)}>
                                Review
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
                <CountTile label={config.historyKpiLabels.approved} value={historyKpis.approved} color="success" />
                <CountTile label={config.historyKpiLabels.rejected} value={historyKpis.rejected} color="error" />
                <CountTile label={config.historyKpiLabels.pending} value={historyKpis.pending} color="brand" />
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
                  <TextField label="Control ID" placeholder="Control ID" value={historyControlId} onChange={setHistoryControlId} />
                  <SelectField label="System" value={historySystem} onChange={setHistorySystem} options={systemOptions} />
                  <SelectField
                    label="Decision"
                    value={historyDecision}
                    onChange={setHistoryDecision}
                    options={[ALL, { value: "Approved", label: "Approved" }, { value: "Rejected", label: "Rejected" }]}
                  />
                  <SelectField label="Ticket Status" value={historyTicketStatus} onChange={setHistoryTicketStatus} options={[ALL, ...historyTicketStatusOptions]} />
                  <SelectField label="Severity" value={historySeverity} onChange={setHistorySeverity} options={SEVERITY_OPTIONS} />
                  <DateRangeField className="sm:col-span-2" label="Date Range" value={dateRange} onChange={setDateRange} />
                </div>
              </Card>

              {filteredHistory.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
                  <EmptyState icon={SearchLg} title="No history yet" description="No reviews have been decided at this stage yet." />
                </div>
              ) : (
                <TableCard
                  title="Reviewer History"
                  count={filteredHistory.length}
                  footer={<Pagination page={historyPages.page} total={historyPages.total} onPageChange={historyPages.setPage} />}
                >
                  <Table>
                    <TableHeader className={THEAD}>
                      <TableRow>
                        <TableSortHeader column="ticket" {...sortProps(historySort)}>
                          Ticket
                        </TableSortHeader>
                        <TableSortHeader column="controlId" {...sortProps(historySort)}>
                          Control ID
                        </TableSortHeader>
                        <TableSortHeader column="system" {...sortProps(historySort)}>
                          System
                        </TableSortHeader>
                        <TableSortHeader column="severity" {...sortProps(historySort)}>
                          Severity
                        </TableSortHeader>
                        <TableSortHeader column="decision" {...sortProps(historySort)}>
                          Decision
                        </TableSortHeader>
                        <TableSortHeader column="reviewedDate" {...sortProps(historySort)}>
                          Reviewed Date
                        </TableSortHeader>
                        <TableSortHeader column="ticketStatus" {...sortProps(historySort)}>
                          Ticket Status
                        </TableSortHeader>
                        <TableCell isHeader className={TH}> </TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody className={TBODY}>
                      {historyPages.paged.map((review) => {
                        const status = statusFieldFor(review, level);
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
                              <XBadge color={badgeColorFor(review.severity)}>{review.severity}</XBadge>
                            </TableCell>
                            <TableCell className={TD}>
                              <XBadge color={DECISION_BADGE_COLOR[status] ?? "gray"}>{DECISION_LABEL[status] || status}</XBadge>
                            </TableCell>
                            <TableCell className={cn(TD, "whitespace-nowrap")}>{formatTimestamp(atFieldFor(review, level))}</TableCell>
                            <TableCell className={TD}>{review.ticketStatus || "—"}</TableCell>
                            <TableCell className={TD}>
                              <div className="flex justify-end">
                                <Button variant="outline" size="sm" className="px-3! py-2!" onClick={() => setSelectedHistoryItem(review)}>
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

      <Dialog
        open={!!selectedHistoryItem}
        onClose={() => setSelectedHistoryItem(null)}
        size="lg"
        title={
          selectedHistoryItem && (
            <span className="flex flex-wrap items-center gap-3">
              {selectedHistoryItem.controlId}
              <XBadge color={DECISION_BADGE_COLOR[statusFieldFor(selectedHistoryItem, level)] ?? "gray"}>
                {DECISION_LABEL[statusFieldFor(selectedHistoryItem, level)] || statusFieldFor(selectedHistoryItem, level)}
              </XBadge>
            </span>
          )
        }
        description={selectedHistoryItem?.controlDescription}
        footer={
          <Button variant="outline" size="sm" onClick={() => setSelectedHistoryItem(null)}>
            Close
          </Button>
        }
      >
        {selectedHistoryItem && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <DetailItem label="Ticket">{selectedHistoryItem.ticketNumber || "—"}</DetailItem>
              <DetailItem label="Ticket Status">{selectedHistoryItem.ticketStatus || "—"}</DetailItem>
              <DetailItem label="System">{selectedHistoryItem.systemId}</DetailItem>
              <DetailItem label="Reviewed Date">{formatTimestamp(atFieldFor(selectedHistoryItem, level))}</DetailItem>
              <DetailItem label="Reviewed By">
                {level === 1 ? selectedHistoryItem.reviewer1ByName : selectedHistoryItem.reviewer2ByName}
              </DetailItem>
            </div>
            <DetailItem label="Root Cause Analysis">{commentFieldFor(selectedHistoryItem, level) || "—"}</DetailItem>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function DecisionSummary({ review, rca, showSystem }: { review: ReviewEntry; rca: string; showSystem?: boolean }) {
  return (
    <div className="mt-4 flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-300">
      <div>
        <span className="font-semibold text-gray-800 dark:text-white/90">Control:</span> {review.controlId} — {review.controlDescription}
      </div>
      {showSystem && (
        <div>
          <span className="font-semibold text-gray-800 dark:text-white/90">System:</span> {review.systemId}
        </div>
      )}
      <div>
        <span className="font-semibold text-gray-800 dark:text-white/90">Root Cause Analysis:</span> {rca}
      </div>
    </div>
  );
}
