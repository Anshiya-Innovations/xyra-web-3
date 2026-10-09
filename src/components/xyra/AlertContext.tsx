import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { type BadgeColors, Card, DetailItem, Dialog, Loading, TBODY, TD, TD_STRONG, TH, THEAD, XBadge } from "@/components/xyra/kit";
import { type AlertHeader, type AlertItem, type RunLogEntry, deviationApi } from "@/lib/api-client";
import { cn } from "@/utils";
import { useEffect, useState } from "react";

const SEVERITY_BADGE_COLOR: Record<string, BadgeColors> = { critical: "error", high: "error", medium: "warning", low: "success" };
const LEVEL_BADGE_COLOR: Record<string, BadgeColors> = { ERROR: "error", WARNING: "warning", INFO: "gray" };
const badgeColorFor = (status: string) => SEVERITY_BADGE_COLOR[(status || "").toLowerCase()] ?? "gray";

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
}

// Timestamp / Level / Message table for a control run's execution logs.
export function RunLogsTable({ logs }: { logs: RunLogEntry[] }) {
  return (
    <div className="max-w-full overflow-x-auto">
      <Table>
        <TableHeader className={THEAD}>
          <TableRow>
            <TableCell isHeader className={TH}>Timestamp</TableCell>
            <TableCell isHeader className={TH}>Log Level</TableCell>
            <TableCell isHeader className={TH}>Message</TableCell>
          </TableRow>
        </TableHeader>
        <TableBody className={TBODY}>
          {logs.map((l) => (
            <TableRow key={l.id}>
              <TableCell className={cn(TD, "whitespace-nowrap")}>{formatTimestamp(l.timestamp)}</TableCell>
              <TableCell className={TD}>
                <XBadge color={LEVEL_BADGE_COLOR[l.level] ?? "gray"}>{l.level}</XBadge>
              </TableCell>
              <TableCell className={TD}>{l.message}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Alert Context Summary + Detailed Deviation Line Items (+ per-item execution
// logs) for one Alert - the read-only half of a review, shared by the
// Reviewer detail page and the Escalation Manager's report view.
export function AlertContext({ alertId }: { alertId: string }) {
  const [header, setHeader] = useState<AlertHeader | null>(null);
  const [items, setItems] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<AlertItem | null>(null);
  const [logs, setLogs] = useState<RunLogEntry[] | null>(null);
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  useEffect(() => {
    setHeader(null);
    setItems([]);
    setLogs(null);
    if (!alertId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    deviationApi
      .getDetail(alertId)
      .then((res) => {
        if (res.success) {
          setHeader(res.header);
          setItems(res.items);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [alertId]);

  // Logs are per Alert (one run), not per line item - fetched once, reused.
  const onOpenLogs = (item: AlertItem) => {
    setActiveItem(item);
    setIsLogsOpen(true);
    if (logs) return;
    setIsLogsLoading(true);
    deviationApi
      .getRunLogs(alertId)
      .then((res) => setLogs(res.success ? res.logs : []))
      .catch(() => setLogs([]))
      .finally(() => setIsLogsLoading(false));
  };

  if (isLoading) return <Loading label="Loading alert context…" />;
  if (!header) return null;

  return (
    <>
      <Card title="Alert Context Summary">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          <DetailItem label="System & Client">{`${header.systemId} (Client ${header.client})`}</DetailItem>
          <DetailItem label="Sector / Platform">{`${header.sector} / ${header.platform}`}</DetailItem>
          <DetailItem label="Alert Date">{formatTimestamp(header.alertDate)}</DetailItem>
          <DetailItem label="Deviations">{`${header.deviationCount} line deviations`}</DetailItem>
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
                  {["SAP Object", "Parameter", "Expected", "Actual", "Status", ""].map((h) => (
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
                    <TableCell className={TD}>{item.expectedValue}</TableCell>
                    <TableCell className={TD_STRONG}>{item.actualValue}</TableCell>
                    <TableCell className={TD}>
                      <XBadge color={badgeColorFor(item.status)}>{item.status}</XBadge>
                    </TableCell>
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
        title={`Automation Execution Logs ${activeItem ? `— ${activeItem.sapObject}/${activeItem.parameter}` : ""}`}
        footer={
          <Button variant="outline" size="sm" onClick={() => setIsLogsOpen(false)}>
            Close
          </Button>
        }
      >
        {isLogsLoading ? (
          <Loading label="Loading execution logs…" />
        ) : !logs || logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No execution logs available.</p>
        ) : (
          <RunLogsTable logs={logs} />
        )}
      </Dialog>
    </>
  );
}
