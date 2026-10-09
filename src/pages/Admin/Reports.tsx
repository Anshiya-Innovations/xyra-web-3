import EmptyState from "@/components/common/EmptyState";
import PageMeta from "@/components/common/PageMeta";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { notify } from "@/components/ui/toast/Toast";
import {
  Card,
  type DateRange,
  DateRangeField,
  KpiTile,
  Loading,
  type Option,
  PageHeader,
  SelectField,
  TableCard,
  TBODY,
  TD,
  TD_STRONG,
  TH,
  THEAD,
  XBadge,
  ymd,
} from "@/components/xyra/kit";
import { type Control, type ControlHistoryEntry, type SystemEntry, controlApi, systemConfigApi } from "@/lib/api-client";
import { cn } from "@/utils";
import { Download01, FileSearch02, RefreshCcw01 } from "@untitledui/icons";
import { useEffect, useMemo, useState } from "react";

const ALL: Option = { value: "All", label: "All" };

type Filters = {
  controlId: string;
  systemId: string;
  client: string;
  region: string;
  platform: string;
  sector: string;
};

const DEFAULT_FILTERS: Filters = { controlId: "", systemId: "All", client: "All", region: "All", platform: "All", sector: "All" };

function distinctOptions(systems: SystemEntry[], get: (s: SystemEntry) => string): Option[] {
  const seen = new Set<string>();
  const out: Option[] = [];
  systems.forEach((s) => {
    const v = get(s);
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

export default function Reports() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  const [controls, setControls] = useState<Control[]>([]);
  const [systems, setSystems] = useState<SystemEntry[]>([]);

  const [rows, setRows] = useState<ControlHistoryEntry[]>([]);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    controlApi
      .list()
      .then((res) => res.success && setControls(res.controls))
      .catch(() => {});
    systemConfigApi
      .list()
      .then((res) => res.success && setSystems(res.systems))
      .catch(() => {});
  }, []);

  const summary = useMemo(() => {
    const deviations = rows.filter((r) => r.deviationFlag).length;
    return { total: rows.length, passed: rows.length - deviations, deviations };
  }, [rows]);

  const set = (key: keyof Filters) => (value: string) => setFilters((f) => ({ ...f, [key]: value }));

  const onGenerate = async () => {
    if (!filters.controlId) {
      notify("error", "Please select a Control.");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await controlApi.listControlHistory({
        controlId: filters.controlId,
        systemId: filters.systemId !== "All" ? filters.systemId : "",
        client: filters.client !== "All" ? filters.client : "",
        region: filters.region !== "All" ? filters.region : "",
        platform: filters.platform !== "All" ? filters.platform : "",
        sector: filters.sector !== "All" ? filters.sector : "",
        startDate: dateRange ? ymd(dateRange.start) : "",
        endDate: dateRange ? ymd(dateRange.end) : "",
      });
      if (!res.success) {
        notify("error", res.message || "Could not load control history.");
        setReportGenerated(false);
        setRows([]);
        return;
      }
      setRows(res.history);
      setReportGenerated(true);
    } catch {
      notify("error", "Could not reach the server. Is xyra-core running?");
      setReportGenerated(false);
      setRows([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const onReset = () => {
    setFilters(DEFAULT_FILTERS);
    setDateRange(null);
    setRows([]);
    setReportGenerated(false);
    notify("success", "Filters reset.");
  };

  const onExportCsv = () => {
    if (rows.length === 0) {
      notify("error", "No control history records available to export.");
      return;
    }
    const header = [
      "Control ID",
      "Description",
      "System ID",
      "Client",
      "Region",
      "Platform",
      "Sector",
      "SAP Object",
      "Parameter",
      "Actual Value",
      "Expected Value",
      "Deviation",
      "Message",
      "Captured At",
    ].join(",");
    const dataRows = rows.map((r) =>
      [
        toCsvCell(r.controlId),
        toCsvCell(r.controlDescription),
        toCsvCell(r.systemId),
        toCsvCell(r.client),
        toCsvCell(r.region),
        toCsvCell(r.platform),
        toCsvCell(r.sector),
        toCsvCell(r.sapObject),
        toCsvCell(r.parameter),
        toCsvCell(r.actualValue),
        toCsvCell(r.expectedValue),
        toCsvCell(r.deviationFlag ? "Deviation" : "OK"),
        toCsvCell(r.message),
        toCsvCell(r.capturedAt),
      ].join(","),
    );
    const blob = new Blob([[header, ...dataRows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `XYRA_Control_History_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify("success", "Control history exported to CSV successfully.");
  };

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title="Reports | Xyra" description="Control history data review" />
      <PageHeader crumbs={["Reports"]} title="Reports" description="Control History Data Review" />

      <Card
        title="Control History Data Review"
        actions={
          <>
            <Button variant="outline" size="sm" startIcon={<Download01 className="size-4" />} onClick={onExportCsv}>
              Export CSV
            </Button>
            <Button variant="outline" size="sm" startIcon={<RefreshCcw01 className="size-4" />} onClick={onReset}>
              Reset Filters
            </Button>
            <Button size="sm" startIcon={<FileSearch02 className="size-4" />} loading={isGenerating} onClick={onGenerate}>
              Generate Report
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            label="Control"
            required
            placeholder="Select control"
            value={filters.controlId}
            onChange={set("controlId")}
            options={controls.map((c) => ({ value: c.id, label: `${c.code} - ${c.description}` }))}
          />
          <SelectField label="System" value={filters.systemId} onChange={set("systemId")} options={[ALL, ...distinctOptions(systems, (s) => s.sysId)]} />
          <SelectField label="Client" value={filters.client} onChange={set("client")} options={[ALL, ...distinctOptions(systems, (s) => s.client)]} />
          <SelectField label="Region" value={filters.region} onChange={set("region")} options={[ALL, ...distinctOptions(systems, (s) => s.region)]} />
          <SelectField label="Platform" value={filters.platform} onChange={set("platform")} options={[ALL, ...distinctOptions(systems, (s) => s.platform)]} />
          <SelectField label="Sector" value={filters.sector} onChange={set("sector")} options={[ALL, ...distinctOptions(systems, (s) => s.sector)]} />
          <DateRangeField className="sm:col-span-2" label="Date Range" value={dateRange} onChange={setDateRange} />
        </div>
      </Card>

      {reportGenerated && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiTile label="Total Values Extracted" value={summary.total} hint="Every value the control checked" color="gray" />
          <KpiTile label="Passed (No Deviation)" value={summary.passed} hint="Matched expected value" color="success" />
          <KpiTile label="Deviations Found" value={summary.deviations} hint="Differed from expected value" color="error" />
        </div>
      )}

      {isGenerating ? (
        <Loading label="Loading control history…" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
          <EmptyState
            icon={FileSearch02}
            title="No report generated yet"
            description="Select a Control and press Generate Report to see extracted values."
          />
        </div>
      ) : (
        <TableCard title="Extracted Control Run Values" count={rows.length}>
          <Table>
            <TableHeader className={THEAD}>
              <TableRow>
                {[
                  "Control ID",
                  "Description",
                  "System",
                  "Client",
                  "Region",
                  "Platform",
                  "Sector",
                  "SAP Object",
                  "Parameter",
                  "Actual",
                  "Expected",
                  "Status",
                  "Captured At",
                ].map((h) => (
                  <TableCell key={h} isHeader className={TH}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className={TBODY}>
              {rows.map((r, i) => (
                <TableRow key={`${r.controlId}-${r.systemId}-${r.sapObject}-${r.parameter}-${i}`}>
                  <TableCell className={TD_STRONG}>{r.controlId}</TableCell>
                  <TableCell className={TD}>{r.controlDescription}</TableCell>
                  <TableCell className={TD}>{r.systemId}</TableCell>
                  <TableCell className={TD}>{r.client}</TableCell>
                  <TableCell className={TD}>{r.region}</TableCell>
                  <TableCell className={TD}>{r.platform}</TableCell>
                  <TableCell className={TD}>{r.sector}</TableCell>
                  <TableCell className={TD}>{r.sapObject}</TableCell>
                  <TableCell className={TD}>{r.parameter}</TableCell>
                  <TableCell className={TD}>{r.actualValue}</TableCell>
                  <TableCell className={TD}>{r.expectedValue}</TableCell>
                  <TableCell className={TD}>
                    <XBadge color={r.deviationFlag ? "error" : "success"}>{r.deviationFlag ? "Deviation" : "OK"}</XBadge>
                  </TableCell>
                  <TableCell className={cn(TD, "whitespace-nowrap")}>{r.capturedAt ? new Date(r.capturedAt).toLocaleString() : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </div>
  );
}
