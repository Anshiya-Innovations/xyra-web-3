import EmptyState from "@/components/common/EmptyState";
import PageMeta from "@/components/common/PageMeta";
import Button from "@/components/ui/button/Button";
import Pagination from "@/components/ui/pagination/Pagination";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import {
  type BadgeColors,
  Card,
  type DateRange,
  DateRangeField,
  Dialog,
  ErrorBanner,
  IconButton,
  Loading,
  type Option,
  PageHeader,
  ReadonlyText,
  SelectField,
  TableCard,
  TBODY,
  TD,
  TextField,
  TH,
  THEAD,
  XBadge,
} from "@/components/xyra/kit";
import { type AuditLogEntry, auditLogApi, controlApi, systemConfigApi } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { cn } from "@/utils";
import { InfoCircle, RefreshCw01, SearchLg } from "@untitledui/icons";
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 10;

// AUDITOR is deliberately allowed - inspecting this trail is the Auditor
// persona's main job (embedded in their own page, see Auditor.tsx).
const NON_ADMIN_ROLES = new Set(["REVIEWER", "REV1", "REV2", "ESCALATION_MANAGER", "USER"]);

const ALL: Option = { value: "All", label: "All" };

const ACTION_OPTIONS: Option[] = [
  { value: "LOGIN", label: "Login" },
  { value: "VIEW_ALERT", label: "View Alert" },
  { value: "VIEW_REPORT", label: "View Report" },
  { value: "REVIEW_APPROVE", label: "Review Approved" },
  { value: "REVIEW_REJECT", label: "Review Rejected" },
  { value: "TICKET_CREATED", label: "Ticket Created" },
  { value: "CONTROL_CREATE", label: "Control Created" },
  { value: "CONTROL_UPDATE", label: "Control Updated" },
  { value: "CONTROL_DELETE", label: "Control Deleted" },
  { value: "CONTROL_RUN", label: "Control Run Now" },
  { value: "SYSTEM_CREATE", label: "System Created" },
  { value: "SYSTEM_UPDATE", label: "System Updated" },
  { value: "SYSTEM_CONTROL_CONFIG_DELETE", label: "Control Mapping Deleted" },
];

const MODULE_OPTIONS: Option[] = [
  "Authentication",
  "Control Management",
  "System Configuration",
  "System Control Config",
  "Deviation Report",
  "Review",
].map((m) => ({ value: m, label: m }));

const RESULT_OPTIONS: Option[] = [
  { value: "Success", label: "Success" },
  { value: "Failure", label: "Failure" },
];

const ACTION_BADGE_COLOR = (action: string): BadgeColors => {
  if (action.includes("DELETE") || action.includes("REJECT")) return "error";
  if (action.includes("CREATE") || action.includes("APPROVE") || action.includes("ACTIVATE")) return "success";
  if (action.includes("UPDATE")) return "brand";
  return "warning";
};

type Filters = {
  searchQuery: string;
  action: string;
  module: string;
  performedBy: string;
  systemId: string;
  controlId: string;
  result: string;
};

const DEFAULT_FILTERS: Filters = {
  searchQuery: "",
  action: "All",
  module: "All",
  performedBy: "All",
  systemId: "All",
  controlId: "All",
  result: "All",
};

function distinctOptions(entries: string[]): Option[] {
  const seen = new Set<string>();
  const out: Option[] = [];
  entries.forEach((v) => {
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

export default function AuditLogs({ embedded = false }: { embedded?: boolean }) {
  const session = getSession();
  const isAdmin = !session?.role || !NON_ADMIN_ROLES.has(session.role.toUpperCase());

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [systemOptions, setSystemOptions] = useState<Option[]>([]);
  const [controlOptions, setControlOptions] = useState<Option[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const loadLogs = () => {
    setIsLoading(true);
    return auditLogApi
      .list()
      .then((res) => {
        if (!res.success) {
          setError(res.message || "Could not load audit logs.");
          setLogs([]);
          return;
        }
        setError(null);
        setLogs(res.logs);
      })
      .catch(() => {
        setError("Could not reach the server. Is xyra-core running?");
        setLogs([]);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadLogs();
    systemConfigApi
      .list()
      .then((res) => res.success && setSystemOptions(res.systems.map((s) => ({ value: s.sysId, label: s.sysId }))))
      .catch(() => {});
    controlApi
      .list()
      .then((res) => res.success && setControlOptions(res.controls.map((c) => ({ value: c.code, label: c.code }))))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const performedByOptions = useMemo(() => distinctOptions(logs.map((l) => l.performedBy)), [logs]);

  const filteredLogs = useMemo(() => {
    const query = filters.searchQuery.toLowerCase().trim();
    const start = dateRange?.start ?? null;
    const end = dateRange?.end ?? null;

    return logs.filter((log) => {
      if (query) {
        const haystack = `${log.id} ${log.performedBy} ${log.action} ${log.module} ${log.objectId} ${log.description}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (filters.action !== "All" && log.action !== filters.action) return false;
      if (filters.module !== "All" && log.module !== filters.module) return false;
      if (filters.performedBy !== "All" && log.performedBy.toLowerCase() !== filters.performedBy.toLowerCase()) return false;
      if (filters.systemId !== "All" && log.systemId !== filters.systemId) return false;
      if (filters.controlId !== "All" && log.controlId !== filters.controlId) return false;
      if (filters.result !== "All") {
        const displayResult = log.result === "SUCCESS" ? "Success" : "Failure";
        if (displayResult !== filters.result) return false;
      }
      if (start || end) {
        const logDate = new Date(log.createdAt);
        if (!isNaN(logDate.getTime())) {
          if (start && logDate < start) return false;
          if (end) {
            const endOfDay = new Date(end.getTime());
            endOfDay.setHours(23, 59, 59, 999);
            if (logDate > endOfDay) return false;
          }
        }
      }
      return true;
    });
  }, [logs, filters, dateRange]);

  const set = (key: keyof Filters) => (value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const onReset = () => {
    setFilters(DEFAULT_FILTERS);
    setDateRange(null);
    setPage(1);
  };

  const onRefresh = () => {
    loadLogs().then(onReset);
  };

  const onExportCsv = () => {
    if (filteredLogs.length === 0) return;
    const header = ["Log ID", "Timestamp", "Admin User", "Action", "Module", "Object ID", "Description", "Previous Value", "New Value", "Result"].join(",");
    const rows = filteredLogs.map((log) =>
      [
        toCsvCell(log.id),
        toCsvCell(log.createdAt),
        toCsvCell(log.performedBy),
        toCsvCell(log.action),
        toCsvCell(log.module),
        toCsvCell(log.objectId),
        toCsvCell(log.description),
        toCsvCell(log.previousValue),
        toCsvCell(log.newValue),
        toCsvCell(log.result === "SUCCESS" ? "Success" : "Failure"),
      ].join(","),
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `XYRA_Admin_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const pagedLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader crumbs={["Audit Logs"]} title="Audit Logs" />
        <ErrorBanner>
          Access Denied: You do not have Administrative privileges to view XYRA Audit Logs. This module is restricted to Admin users
          only.
        </ErrorBanner>
      </div>
    );
  }

  const refreshButton = (
    <Button variant="outline" size="sm" startIcon={<RefreshCw01 className="size-4" />} onClick={onRefresh}>
      Refresh
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">Read-only evidence of every recorded action across the platform.</p>
          {refreshButton}
        </div>
      ) : (
        <>
          <PageMeta title="Audit Logs | Xyra" description="Admin activity history" />
          <PageHeader crumbs={["Audit Logs"]} title="Audit Logs" description="Admin Activity History" actions={refreshButton} />
        </>
      )}

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Card
        title="Admin Activity Filters"
        actions={
          <Button variant="outline" size="sm" onClick={onReset}>
            Reset
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField label="Search" placeholder="Search Log ID, Admin..." value={filters.searchQuery} onChange={set("searchQuery")} />
          <SelectField label="Action" value={filters.action} onChange={set("action")} options={[ALL, ...ACTION_OPTIONS]} />
          <SelectField label="Module" value={filters.module} onChange={set("module")} options={[ALL, ...MODULE_OPTIONS]} />
          <SelectField label="Performed By" value={filters.performedBy} onChange={set("performedBy")} options={[ALL, ...performedByOptions]} />
          <SelectField label="System" value={filters.systemId} onChange={set("systemId")} options={[ALL, ...systemOptions]} />
          <SelectField label="Control" value={filters.controlId} onChange={set("controlId")} options={[ALL, ...controlOptions]} />
          <SelectField label="Result" value={filters.result} onChange={set("result")} options={[ALL, ...RESULT_OPTIONS]} />
          <DateRangeField
            label="Date Range"
            value={dateRange}
            onChange={(r) => {
              setDateRange(r);
              setPage(1);
            }}
          />
        </div>
      </Card>

      {isLoading ? (
        <Loading label="Loading audit logs…" />
      ) : filteredLogs.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
          <EmptyState icon={SearchLg} title="No audit logs found" description="No audit logs match the selected filter criteria." />
        </div>
      ) : (
        <TableCard
          title="Admin Activity Audit Trail"
          count={filteredLogs.length}
          actions={
            <Button variant="outline" size="sm" onClick={onExportCsv}>
              Export CSV
            </Button>
          }
          footer={<Pagination page={page} total={totalPages} onPageChange={setPage} />}
        >
          <Table>
            <TableHeader className={THEAD}>
              <TableRow>
                {["Timestamp", "Admin User", "Action", "Module", "Object ID", "Description", "Result", "Details"].map((h) => (
                  <TableCell key={h} isHeader className={TH}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className={TBODY}>
              {pagedLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className={cn(TD, "whitespace-nowrap")}>
                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className={TD}>{log.performedBy}</TableCell>
                  <TableCell className={TD}>
                    <XBadge color={ACTION_BADGE_COLOR(log.action)}>{log.action}</XBadge>
                  </TableCell>
                  <TableCell className={TD}>{log.module}</TableCell>
                  <TableCell className={TD}>{log.objectLabel || log.objectId}</TableCell>
                  <TableCell className={cn(TD, "max-w-xs truncate")}>{log.description}</TableCell>
                  <TableCell className={TD}>
                    <XBadge color={log.result === "SUCCESS" ? "success" : "error"}>{log.result === "SUCCESS" ? "Success" : "Failure"}</XBadge>
                  </TableCell>
                  <TableCell className={TD}>
                    <IconButton icon={InfoCircle} title="View log details" onClick={() => setSelectedLog(log)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}

      <Dialog
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        size="lg"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {selectedLog?.id}
            {selectedLog && (
              <XBadge color={selectedLog.result === "SUCCESS" ? "success" : "error"}>
                {selectedLog.result === "SUCCESS" ? "Success" : "Failure"}
              </XBadge>
            )}
          </span>
        }
        description="Administrative Action Evidence Record"
        footer={
          <Button size="sm" onClick={() => setSelectedLog(null)}>
            Close
          </Button>
        }
      >
        {selectedLog && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="Log ID" readOnly value={selectedLog.id} />
              <TextField label="Timestamp" readOnly value={selectedLog.createdAt ? new Date(selectedLog.createdAt).toLocaleString() : ""} />
              <TextField label="Admin User" readOnly value={selectedLog.performedBy} />
              <TextField label="Action" readOnly value={selectedLog.action} />
              <TextField label="Module" readOnly value={selectedLog.module} />
              <TextField label="Object ID" readOnly value={selectedLog.objectLabel || selectedLog.objectId} />
            </div>
            <ReadonlyText label="Description" value={selectedLog.description} />
            {(selectedLog.previousValue || selectedLog.newValue) && (
              <>
                <ReadonlyText label="Previous Value" value={selectedLog.previousValue} />
                <ReadonlyText label="New Value" value={selectedLog.newValue} />
              </>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
