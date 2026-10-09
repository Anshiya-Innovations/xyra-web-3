import EmptyState from "@/components/common/EmptyState";
import PageMeta from "@/components/common/PageMeta";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Tabs from "@/components/ui/tabs/Tabs";
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
import { DECISION_BADGE_COLOR, DECISION_LABEL, listClosedReviews, ReviewReport, terminalAt, terminalStatus } from "@/components/xyra/ReviewReport";
import { type DeviationKpi, type ReviewEntry, deviationApi } from "@/lib/api-client";
import AuditLogs from "@/pages/Admin/AuditLogs";
import { cn } from "@/utils";
import { RefreshCw01, SearchLg } from "@untitledui/icons";
import { type ReactNode, useEffect, useMemo, useState } from "react";

type Tab = "records" | "remediation" | "history";
const ALL: Option = { value: "All", label: "All" };

const distinctOptions = (values: string[]): Option[] => [...new Set(values.filter(Boolean))].map((v) => ({ value: v, label: v }));

const deviationText = (r: ReviewEntry) => `${r.sapObject}/${r.parameter}: expected '${r.expectedValue}', got '${r.actualValue}'`;

function inDateRange(iso: string | null, range: DateRange | null): boolean {
  if (!range) return true;
  if (!iso) return false;
  const d = new Date(iso);
  const end = new Date(range.end.getTime());
  end.setHours(23, 59, 59, 999);
  return d >= range.start && d <= end;
}

// Auditor persona: independent, read-only oversight. Audit Records -> the
// platform audit trail, Remediation Review -> rejected deviations and their
// remediation tickets, Audit History -> every review that reached a final outcome.
export default function Auditor() {
  const [activeTab, setActiveTab] = useState<Tab>("records");
  const [kpi, setKpi] = useState<DeviationKpi | null>(null);
  const [closed, setClosed] = useState<ReviewEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReviewEntry | null>(null);

  const [remQuery, setRemQuery] = useState("");
  const [remSystem, setRemSystem] = useState("All");
  const [remStatus, setRemStatus] = useState("All");

  const [histQuery, setHistQuery] = useState("");
  const [histSystem, setHistSystem] = useState("All");
  const [histDecision, setHistDecision] = useState("All");
  const [histRange, setHistRange] = useState<DateRange | null>(null);

  const load = () => {
    setIsLoading(true);
    Promise.all([deviationApi.list({}), listClosedReviews()])
      .then(([dev, reviews]) => {
        setError(dev.success ? null : dev.message || "Could not load deviation KPIs.");
        if (dev.success) setKpi(dev.kpi);
        setClosed(reviews);
      })
      .catch((e) =>
        setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Could not reach the server. Is xyra-core running?"),
      )
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const remediations = useMemo(() => closed.filter((r) => r.ticketNumber), [closed]);
  const openRemediations = remediations.filter((r) => !r.ticketResolved).length;

  const filteredRemediations = useMemo(() => {
    const q = remQuery.trim().toLowerCase();
    return remediations.filter((r) => {
      if (q && !`${r.ticketNumber} ${r.controlId} ${r.controlDescription} ${r.parameter}`.toLowerCase().includes(q)) return false;
      if (remSystem !== "All" && r.systemId !== remSystem) return false;
      if (remStatus !== "All" && (r.ticketResolved ? "Resolved" : "Open") !== remStatus) return false;
      return true;
    });
  }, [remediations, remQuery, remSystem, remStatus]);

  const filteredHistory = useMemo(() => {
    const q = histQuery.trim().toLowerCase();
    return closed.filter((r) => {
      if (q && !`${r.controlId} ${r.controlDescription} ${r.ticketNumber} ${r.reviewer1ByName} ${r.reviewer2ByName}`.toLowerCase().includes(q))
        return false;
      if (histSystem !== "All" && r.systemId !== histSystem) return false;
      if (histDecision !== "All" && DECISION_LABEL[terminalStatus(r)] !== histDecision) return false;
      return inDateRange(terminalAt(r), histRange);
    });
  }, [closed, histQuery, histSystem, histDecision, histRange]);

  const systemOptions = useMemo(() => [ALL, ...distinctOptions(closed.map((r) => r.systemId))], [closed]);

  if (isLoading) return <Loading label="Loading auditor dashboard…" />;

  if (selected) return <ReviewReport review={selected} parentLabel="Auditor Dashboard" onBack={() => setSelected(null)} />;

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title="Auditor Dashboard | Xyra" description="Read-only audit oversight" />
      <PageHeader
        crumbs={["Auditor Dashboard"]}
        title="Auditor Dashboard"
        description="Independent, read-only inspection of control activity, remediation and review evidence."
        actions={
          <Button variant="outline" size="sm" startIcon={<RefreshCw01 className="size-4" />} onClick={load}>
            Refresh
          </Button>
        }
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CountTile label="Control Compliance Rate" value={kpi?.complianceRate ?? "—"} color="success" />
        <CountTile label="Deviation Alerts" value={kpi?.totalIncidents ?? "—"} />
        <CountTile label="Open Remediation Tickets" value={openRemediations} color={openRemediations ? "error" : "success"} />
        <CountTile label="Closed Reviews" value={closed.length} color="brand" />
      </div>

      <div>
        <Tabs
          selected={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: "records", label: "Audit Records" },
            { id: "remediation", label: "Remediation Review" },
            { id: "history", label: "Audit History" },
          ]}
        />

        <div className="pt-6">
          {activeTab === "records" && <AuditLogs embedded />}

          {activeTab === "remediation" && (
            <div className="flex flex-col gap-6">
              <FilterCard
                onReset={() => {
                  setRemQuery("");
                  setRemSystem("All");
                  setRemStatus("All");
                }}
              >
                <TextField label="Search" placeholder="Search Ticket, Control ID, Parameter..." value={remQuery} onChange={setRemQuery} />
                <SelectField label="System" value={remSystem} onChange={setRemSystem} options={systemOptions} />
                <SelectField
                  label="Ticket Status"
                  value={remStatus}
                  onChange={setRemStatus}
                  options={[ALL, { value: "Open", label: "Open" }, { value: "Resolved", label: "Resolved" }]}
                />
              </FilterCard>

              {filteredRemediations.length === 0 ? (
                <Empty title="No remediation items" description="No rejected deviations with remediation tickets match these filters." />
              ) : (
                <TableCard title="Remediation Tracking" count={filteredRemediations.length}>
                  <Table>
                    <TableHeader className={THEAD}>
                      <TableRow>
                        {["Ticket", "Control ID", "System", "Deviation", "Rejected At", "Ticket Status", ""].map((h) => (
                          <TableCell key={h} isHeader className={TH}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody className={TBODY}>
                      {filteredRemediations.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className={TD_STRONG}>{r.ticketNumber}</TableCell>
                          <TableCell className={TD}>
                            <div className="font-medium text-gray-800 dark:text-white/90">{r.controlId}</div>
                            <div className="text-theme-xs">{r.controlDescription}</div>
                          </TableCell>
                          <TableCell className={TD}>{r.systemId}</TableCell>
                          <TableCell className={cn(TD, "max-w-xs truncate")}>
                            <span title={deviationText(r)}>{deviationText(r)}</span>
                          </TableCell>
                          <TableCell className={TD}>{r.ticketLevel ? `Level ${r.ticketLevel}` : "—"}</TableCell>
                          <TableCell className={TD}>
                            <XBadge color={r.ticketResolved ? "success" : "error"}>{r.ticketStatus || (r.ticketResolved ? "Resolved" : "Open")}</XBadge>
                          </TableCell>
                          <TableCell className={TD}>
                            <div className="flex justify-end">
                              <Button variant="outline" size="sm" className="px-3! py-2!" onClick={() => setSelected(r)}>
                                View Evidence
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
              <FilterCard
                onReset={() => {
                  setHistQuery("");
                  setHistSystem("All");
                  setHistDecision("All");
                  setHistRange(null);
                }}
              >
                <TextField label="Search" placeholder="Search Control ID, Ticket, Reviewer..." value={histQuery} onChange={setHistQuery} />
                <SelectField label="System" value={histSystem} onChange={setHistSystem} options={systemOptions} />
                <SelectField
                  label="Decision"
                  value={histDecision}
                  onChange={setHistDecision}
                  options={[ALL, { value: "Approved", label: "Approved" }, { value: "Rejected", label: "Rejected" }]}
                />
                <DateRangeField label="Decided Date" value={histRange} onChange={setHistRange} />
              </FilterCard>

              {filteredHistory.length === 0 ? (
                <Empty title="No history yet" description="No reviews matching these filters have reached a final outcome." />
              ) : (
                <TableCard title="Closed Review Records" count={filteredHistory.length}>
                  <Table>
                    <TableHeader className={THEAD}>
                      <TableRow>
                        {["Control ID", "System", "Final Decision", "Decided By", "Decided Date", "Ticket", ""].map((h) => (
                          <TableCell key={h} isHeader className={TH}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody className={TBODY}>
                      {filteredHistory.map((r) => {
                        const status = terminalStatus(r);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className={TD}>
                              <div className="font-medium text-gray-800 dark:text-white/90">{r.controlId}</div>
                              <div className="text-theme-xs">{r.controlDescription}</div>
                            </TableCell>
                            <TableCell className={TD}>{r.systemId}</TableCell>
                            <TableCell className={TD}>
                              <XBadge color={DECISION_BADGE_COLOR[status] ?? "gray"}>{DECISION_LABEL[status] || status}</XBadge>
                            </TableCell>
                            <TableCell className={TD}>{(r.reviewer2Status !== "NEW" ? r.reviewer2ByName : r.reviewer1ByName) || "—"}</TableCell>
                            <TableCell className={cn(TD, "whitespace-nowrap")}>{formatTimestamp(terminalAt(r))}</TableCell>
                            <TableCell className={TD}>{r.ticketNumber || "—"}</TableCell>
                            <TableCell className={TD}>
                              <div className="flex justify-end">
                                <Button variant="outline" size="sm" className="px-3! py-2!" onClick={() => setSelected(r)}>
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

function FilterCard({ onReset, children }: { onReset: () => void; children: ReactNode }) {
  return (
    <Card
      title="Filters"
      actions={
        <Button variant="outline" size="sm" onClick={onReset}>
          Reset
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </Card>
  );
}

function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
      <EmptyState icon={SearchLg} title={title} description={description} />
    </div>
  );
}
