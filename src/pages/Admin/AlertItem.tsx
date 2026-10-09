import PageMeta from "@/components/common/PageMeta";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { formatTimestamp, RunLogsTable } from "@/components/xyra/AlertContext";
import { type BadgeColors, Card, DetailItem, Dialog, ErrorBanner, Loading, PageHeader, TBODY, TD, TD_STRONG, TH, THEAD, XBadge } from "@/components/xyra/kit";
import { type AlertHeader, type AlertItem as Item, type RunLogEntry, deviationApi } from "@/lib/api-client";
import { cn } from "@/utils";
import { ArrowLeft, Download01, RefreshCw01 } from "@untitledui/icons";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

const STATUS_BADGE_COLOR: Record<string, BadgeColors> = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "success",
  open: "error",
  "in progress": "warning",
  resolved: "success",
};
const badgeColorFor = (status: string) => STATUS_BADGE_COLOR[(status || "").toLowerCase()] ?? "gray";

function downloadLogsCsv(header: AlertHeader | null, logs: RunLogEntry[]) {
  if (!logs.length) return;
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Timestamp", "Level", "Message"].map(escape).join(","), ...logs.map((l) => [l.timestamp, l.level, l.message].map(escape).join(","))];
  const blob = new Blob(["﻿" + rows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeControl = (header?.controlId || "alert").replace(/[^a-z0-9_-]/gi, "_");
  a.href = url;
  a.download = `XYRA_Execution_Logs_${safeControl}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AlertItem() {
  const navigate = useNavigate();
  const { alertId } = useParams();
  const [header, setHeader] = useState<AlertHeader | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [logs, setLogs] = useState<RunLogEntry[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [cachedLogs, setCachedLogs] = useState<RunLogEntry[] | null>(null);

  const load = () => {
    if (!alertId) return;
    setIsLoading(true);
    deviationApi
      .getDetail(alertId)
      .then((res) => {
        if (!res.success || !res.header) {
          setError(res.message || "Could not load this alert.");
          return;
        }
        setError(null);
        setHeader(res.header);
        setItems(res.items);
      })
      .catch(() => setError("Could not reach the server. Is xyra-core running?"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    setCachedLogs(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertId]);

  // ControlRunLogs are scoped to the whole alert/run, not one line item -
  // every "Logs" button shows the same rows (fetched once, cached).
  const onOpenLogs = (item: Item) => {
    setActiveItem(item);
    setIsLogsOpen(true);
    if (cachedLogs) {
      setLogs(cachedLogs);
      return;
    }
    if (!alertId) return;
    setIsLogsLoading(true);
    deviationApi
      .getRunLogs(alertId)
      .then((res) => {
        const rows = res.success ? res.logs : [];
        setCachedLogs(rows);
        setLogs(rows);
      })
      .catch(() => setLogs([]))
      .finally(() => setIsLogsLoading(false));
  };

  if (isLoading) return <Loading label="Gathering alert details…" />;

  if (!header) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorBanner>{error || "Alert not found."}</ErrorBanner>
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          startIcon={<ArrowLeft className="size-4" />}
          onClick={() => navigate("/deviation-report")}
        >
          Back to Deviation Report
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title={`${header.controlId} Alert | Xyra`} description="Alert item details" />
      <PageHeader
        crumbs={["Control Management", "Deviation Report", `${header.controlId} Alert Details`]}
        onBack={() => navigate("/deviation-report")}
        title="Alert Item Details"
        description={`Control ${header.controlId} line item analysis`}
        actions={
          <Button variant="outline" size="sm" startIcon={<RefreshCw01 className="size-4" />} onClick={load}>
            Refresh
          </Button>
        }
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Card title="Alert Context Summary">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          <DetailItem label="Control ID & Name">
            {header.controlId}
            <span className="block text-sm font-normal text-gray-500 dark:text-gray-400">{header.controlDescription}</span>
          </DetailItem>
          <DetailItem label="System & Client">
            {header.systemId} (Client {header.client})
            <span className="block text-sm font-normal text-gray-500 dark:text-gray-400">
              Sector: {header.sector} | Platform: {header.platform}
            </span>
          </DetailItem>
          <DetailItem label="Status & Severity">
            <span className="flex items-center gap-2">
              <XBadge color={badgeColorFor(header.status)}>{header.status}</XBadge>
              <XBadge color={badgeColorFor(header.severity)}>{header.severity}</XBadge>
            </span>
          </DetailItem>
          <DetailItem label="Alert Date & Deviations">
            {formatTimestamp(header.alertDate)}
            <span className="block text-sm font-normal text-gray-500 dark:text-gray-400">{header.deviationCount} line deviations</span>
          </DetailItem>
        </div>
        <div className="mt-6">
          <DetailItem label="Incident Description">{header.description || "—"}</DetailItem>
        </div>
      </Card>

      <Card title="Detailed Deviation Line Items" bodyClassName="p-0 sm:p-0">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No detailed deviation line items found.</p>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className={THEAD}>
                <TableRow>
                  {["SAP Object", "Parameter", "Operator", "Expected Value", "Actual Detected Value", "Status", "Timestamp", ""].map((h) => (
                    <TableCell key={h} isHeader className={TH}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className={TBODY}>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className={TD_STRONG}>{item.sapObject}</TableCell>
                    <TableCell className={TD}>{item.parameter}</TableCell>
                    <TableCell className={TD}>{item.operator}</TableCell>
                    <TableCell className={TD}>{item.expectedValue}</TableCell>
                    <TableCell className={TD_STRONG}>{item.actualValue}</TableCell>
                    <TableCell className={TD}>
                      <XBadge color={badgeColorFor(item.status)}>{item.status}</XBadge>
                    </TableCell>
                    <TableCell className={cn(TD, "whitespace-nowrap")}>{formatTimestamp(item.timestamp)}</TableCell>
                    <TableCell className={TD}>
                      <Button size="sm" className="px-3! py-2!" onClick={() => onOpenLogs(item)}>
                        Logs
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog
        open={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
        size="lg"
        title={
          <span className="flex flex-wrap items-center gap-3">
            Control ID: {header.controlId} {activeItem ? `(${activeItem.sapObject}/${activeItem.parameter})` : ""}
            {activeItem && <XBadge color={badgeColorFor(activeItem.status)}>{activeItem.status}</XBadge>}
          </span>
        }
        description={header.controlDescription}
        footer={
          <div className="flex w-full justify-between">
            <Button
              variant="outline"
              size="sm"
              startIcon={<Download01 className="size-4" />}
              disabled={!logs.length}
              onClick={() => downloadLogsCsv(header, logs)}
            >
              Download Log
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsLogsOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        {isLogsLoading ? (
          <Loading label="Loading execution logs…" />
        ) : logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No execution logs available.</p>
        ) : (
          <RunLogsTable logs={logs} />
        )}
      </Dialog>
    </div>
  );
}
