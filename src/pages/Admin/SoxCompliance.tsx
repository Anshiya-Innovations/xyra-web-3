import EmptyState from "@/components/common/EmptyState";
import PageMeta from "@/components/common/PageMeta";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { notify } from "@/components/ui/toast/Toast";
import { formatTimestamp } from "@/components/xyra/AlertContext";
import { DonutChart } from "@/components/xyra/charts";
import {
  type BadgeColors,
  Card,
  DetailItem,
  Dialog,
  ErrorBanner,
  Loading,
  PageHeader,
  SearchInput,
  SelectField,
  TableCard,
  TBODY,
  TD,
  TD_STRONG,
  TH,
  THEAD,
  XBadge,
} from "@/components/xyra/kit";
import {
  type AlertHeader,
  type Control,
  type DeviationKpi,
  type SystemControlConfig,
  controlApi,
  deviationApi,
  systemControlConfigApi,
} from "@/lib/api-client";
import { FREQ_BE_TO_UI } from "@/lib/control-frequency";
import { cn } from "@/utils";
import { Download01, RefreshCw01, SearchLg } from "@untitledui/icons";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

type Status = "Compliant" | "Non-Compliant" | "Pending Review" | "Not Tested";

const STATUS_COLORS: Record<Status, string> = { Compliant: "#12B76A", "Non-Compliant": "#F04438", "Pending Review": "#F79009", "Not Tested": "#98A2B3" };
const STATUS_BADGE: Record<Status, BadgeColors> = { Compliant: "success", "Non-Compliant": "error", "Pending Review": "warning", "Not Tested": "gray" };
const RISK_BADGE: Record<string, BadgeColors> = { HIGH: "error", MEDIUM: "warning", LOW: "success" };
const SEVERITY_ORDER = ["Critical", "High", "Medium", "Low"] as const;
const SEVERITY_BADGE: Record<string, BadgeColors> = { Critical: "error", High: "error", Medium: "warning", Low: "success" };
const ALERT_STATUS_BADGE: Record<string, BadgeColors> = { Open: "error", "In Progress": "warning", Resolved: "success" };

const titleCase = (s: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : "");
const toCsvCell = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;

type Row = SystemControlConfig & {
  status: Status;
  openAlerts: AlertHeader[]; // unresolved (Open + In Progress) alerts for this control on this system/client
  deviationCount: number; // line items across those unresolved alerts
};

// One row per control <-> system mapping - that's the unit a control is
// actually tested on. Status is derived from the mapping's run record plus the
// review state of its deviation alerts; nothing here is stored separately.
function toRow(m: SystemControlConfig, alerts: AlertHeader[]): Row {
  const mine = alerts.filter((a) => a.controlId === m.controlCode && a.systemId === m.systemCode && a.client === m.systemClient);
  const openAlerts = mine.filter((a) => a.status !== "Resolved");
  const status: Status = !m.lastRunAt
    ? "Not Tested"
    : openAlerts.some((a) => a.status === "Open")
      ? "Non-Compliant"
      : openAlerts.length
        ? "Pending Review"
        : "Compliant";
  return { ...m, status, openAlerts, deviationCount: openAlerts.reduce((n, a) => n + a.deviationCount, 0) };
}

export default function SoxCompliance() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [kpi, setKpi] = useState<DeviationKpi | null>(null);
  const [controls, setControls] = useState<Control[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [systemFilter, setSystemFilter] = useState("All");
  const [selected, setSelected] = useState<Row | null>(null);

  const load = () => {
    setIsLoading(true);
    Promise.all([systemControlConfigApi.list(), deviationApi.list({}), controlApi.list()])
      .then(([mapRes, devRes, ctlRes]) => {
        if (!mapRes.success || !devRes.success) {
          setError(mapRes.message || devRes.message || "Could not load SOX compliance data.");
          return;
        }
        setError(null);
        setKpi(devRes.kpi);
        setRows(mapRes.configs.map((m) => toRow(m, devRes.headers)));
        if (ctlRes.success) setControls(ctlRes.controls);
      })
      .catch(() => setError("Could not reach the server. Is xyra-core running?"))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  // Scoped to monitored mappings, not every alert in the tenant.
  const unresolvedAlerts = useMemo(() => rows.flatMap((r) => r.openAlerts), [rows]);

  const statusCounts = useMemo(() => {
    const counts: Record<Status, number> = { Compliant: 0, "Non-Compliant": 0, "Pending Review": 0, "Not Tested": 0 };
    rows.forEach((r) => counts[r.status]++);
    return counts;
  }, [rows]);

  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    unresolvedAlerts.forEach((a) => {
      if (a.severity in counts) counts[a.severity]++;
    });
    return counts;
  }, [unresolvedAlerts]);

  const activeCount = rows.filter((r) => r.enabled).length;
  const openDeviations = rows.reduce((n, r) => n + r.deviationCount, 0);
  const highRiskOpen = severityCounts.Critical + severityCounts.High;
  const donut = (Object.keys(statusCounts) as Status[]).filter((s) => statusCounts[s] > 0);

  const systemOptions = useMemo(
    () => [...new Set(rows.map((r) => r.systemCode).filter(Boolean))].map((s) => ({ value: s, label: s })),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.controlCode} ${r.controlDescription}`.toLowerCase().includes(q)) return false;
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      if (systemFilter !== "All" && r.systemCode !== systemFilter) return false;
      return true;
    });
  }, [rows, query, statusFilter, systemFilter]);

  const onExportCsv = () => {
    if (filtered.length === 0) {
      notify("error", "No SOX controls available to export.");
      return;
    }
    const header = [
      "Control ID",
      "Description",
      "System",
      "Client",
      "Frequency",
      "Active",
      "Compliance Status",
      "Open Deviations",
      "Risk",
      "Last Run",
      "Last Result",
    ].join(",");
    const lines = filtered.map((r) =>
      [
        r.controlCode,
        r.controlDescription,
        r.systemCode,
        r.systemClient,
        FREQ_BE_TO_UI[r.controlFrequency] || r.controlFrequency,
        r.enabled ? "Yes" : "No",
        r.status,
        r.deviationCount,
        titleCase(r.controlSeverity),
        r.lastRunAt || "",
        r.lastRunStatus,
      ]
        .map(toCsvCell)
        .join(","),
    );
    const url = URL.createObjectURL(new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `XYRA_SOX_Control_Monitoring_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    notify("success", "SOX controls exported to CSV.");
  };

  if (isLoading) return <Loading label="Loading SOX compliance…" />;

  const selectedControl = selected ? controls.find((c) => c.id === selected.controlId) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title="SOX Compliance | Xyra" description="Sarbanes-Oxley control testing status" />
      <PageHeader
        crumbs={["SOX Compliance"]}
        title="SOX Compliance"
        description="Sarbanes-Oxley control testing status across every monitored control and system."
        actions={
          <Button variant="outline" size="sm" startIcon={<RefreshCw01 className="size-4" />} onClick={load}>
            Refresh
          </Button>
        }
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <SoxStat label="Monitored Controls" value={rows.length} note="Control × system mappings" />
        <SoxStat
          label="Active Automated"
          value={activeCount}
          note={rows.length ? `${Math.round((activeCount / rows.length) * 100)}% running on schedule` : "—"}
          tone="brand"
        />
        <SoxStat label="Open Deviations" value={openDeviations} note="Unresolved line items" tone={openDeviations ? "error" : "success"} />
        <SoxStat label="Compliance Score" value={kpi?.complianceRate ?? "—"} note="Rule checks passed" tone="success" />
        <SoxStat label="High-Risk Issues" value={highRiskOpen} note="Unresolved high/critical alerts" tone={highRiskOpen ? "error" : "success"} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Compliance Status Distribution" description="Breakdown of monitored controls by current status">
          {donut.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">No controls are mapped to systems yet.</p>
          ) : (
            <DonutChart labels={donut} series={donut.map((s) => statusCounts[s])} colors={donut.map((s) => STATUS_COLORS[s])} />
          )}
        </Card>

        <Card title="Risk & Alert Summary" description="Unresolved deviation alerts by severity">
          <div className="flex flex-col gap-3">
            {SEVERITY_ORDER.map((sev) => (
              <div key={sev} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 dark:border-gray-800">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{sev}</span>
                <XBadge color={SEVERITY_BADGE[sev]}>{severityCounts[sev]}</XBadge>
              </div>
            ))}
          </div>
          {statusCounts["Non-Compliant"] > 0 && (
            <p className="mt-4 rounded-lg border border-warning-500/30 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:bg-warning-500/15 dark:text-orange-400">
              Action required: {statusCounts["Non-Compliant"]} control mapping(s) have open deviations awaiting review.
            </p>
          )}
        </Card>
      </div>

      <TableCard
        title="SOX Control Monitoring"
        count={filtered.length}
        actions={
          <>
            <SearchInput placeholder="Search Control ID or Description..." value={query} onChange={setQuery} />
            <SelectField
              className="w-44"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[{ value: "All", label: "All Statuses" }, ...(Object.keys(STATUS_COLORS) as Status[]).map((s) => ({ value: s, label: s }))]}
            />
            <SelectField
              className="w-36"
              value={systemFilter}
              onChange={setSystemFilter}
              options={[{ value: "All", label: "All Systems" }, ...systemOptions]}
            />
            <Button variant="outline" size="sm" startIcon={<Download01 className="size-4" />} onClick={onExportCsv}>
              Export CSV
            </Button>
          </>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={SearchLg}
            title={rows.length ? "No matching controls" : "No monitored controls yet"}
            description={rows.length ? "Try different filters." : "Map a control to a system in System Control Config to start monitoring it."}
          />
        ) : (
          <Table>
            <TableHeader className={THEAD}>
              <TableRow>
                {["Control ID", "Description", "System", "Frequency", "Compliance Status", "Open Deviations", "Risk", "Last Run", "Actions"].map((h) => (
                  <TableCell key={h} isHeader className={TH}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className={TBODY}>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className={TD}>
                    <button type="button" className="font-medium text-brand-500 hover:underline dark:text-brand-400" onClick={() => setSelected(r)}>
                      {r.controlCode}
                    </button>
                    {!r.enabled && <div className="text-theme-xs">Inactive</div>}
                  </TableCell>
                  <TableCell className={cn(TD, "max-w-xs truncate")}>{r.controlDescription}</TableCell>
                  <TableCell className={TD}>
                    {r.systemCode}/{r.systemClient}
                  </TableCell>
                  <TableCell className={TD}>{FREQ_BE_TO_UI[r.controlFrequency] || r.controlFrequency}</TableCell>
                  <TableCell className={TD}>
                    <XBadge color={STATUS_BADGE[r.status]}>{r.status}</XBadge>
                  </TableCell>
                  <TableCell className={cn(TD, r.deviationCount && "font-semibold text-error-600 dark:text-error-500")}>{r.deviationCount}</TableCell>
                  <TableCell className={TD}>
                    <XBadge color={RISK_BADGE[r.controlSeverity] ?? "gray"}>{titleCase(r.controlSeverity)}</XBadge>
                  </TableCell>
                  <TableCell className={cn(TD, "whitespace-nowrap")}>{formatTimestamp(r.lastRunAt)}</TableCell>
                  <TableCell className={TD}>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" className="px-3! py-2!" onClick={() => setSelected(r)}>
                        View Details
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        size="lg"
        title={
          selected && (
            <span className="flex flex-wrap items-center gap-3">
              {selected.controlCode} – {selected.controlDescription}
              <XBadge color={STATUS_BADGE[selected.status]}>{selected.status}</XBadge>
            </span>
          )
        }
        description={selected && `${titleCase(selected.controlType) || "—"} control on ${selected.systemCode}/${selected.systemClient}`}
        footer={
          selected && (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate(`/system-control-config/${selected.id}`)}>
                View Run Logs
              </Button>
              <Button size="sm" onClick={() => setSelected(null)}>
                Close
              </Button>
            </>
          )
        }
      >
        {selected && (
          <div className="flex flex-col gap-6">
            <section>
              <h5 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">Control Overview</h5>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <DetailItem label="Target System">{`${selected.systemCode} (Client ${selected.systemClient})`}</DetailItem>
                <DetailItem label="Execution Frequency">{FREQ_BE_TO_UI[selected.controlFrequency] || selected.controlFrequency}</DetailItem>
                <DetailItem label="Automation">{selected.enabled ? "Automated — running on schedule" : "Automated — mapping inactive"}</DetailItem>
                <DetailItem label="Risk Severity">{titleCase(selected.controlSeverity)}</DetailItem>
                <DetailItem label="Open Deviations">{String(selected.deviationCount)}</DetailItem>
                <DetailItem label="Last Execution">
                  {selected.lastRunAt ? `${formatTimestamp(selected.lastRunAt)} (${selected.lastRunStatus || "—"})` : "Never run"}
                </DetailItem>
                <DetailItem label="Total Runs">{String(selected.runCount)}</DetailItem>
              </div>
            </section>

            <section>
              <h5 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">Rule Validation Parameters</h5>
              {!selectedControl || selectedControl.rules.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No rules found for this control.</p>
              ) : (
                <div className="max-w-full overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                  <Table>
                    <TableHeader className={THEAD}>
                      <TableRow>
                        {["SAP Object", "Parameter", "Operator", "Expected Value"].map((h) => (
                          <TableCell key={h} isHeader className={TH}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody className={TBODY}>
                      {selectedControl.rules.map((rule, i) => (
                        <TableRow key={rule.id || String(i)}>
                          <TableCell className={TD_STRONG}>{rule.sapObject}</TableCell>
                          <TableCell className={TD}>{rule.parameter}</TableCell>
                          <TableCell className={TD}>{rule.operator}</TableCell>
                          <TableCell className={TD}>{rule.expectedValue}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            <section>
              <h5 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">Execution Findings</h5>
              {selected.openAlerts.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selected.lastRunAt
                    ? "No unresolved deviations — the control is operating effectively."
                    : "This control has not been executed on this system yet."}
                </p>
              ) : (
                <div className="max-w-full overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                  <Table>
                    <TableHeader className={THEAD}>
                      <TableRow>
                        {["Alert Date", "Deviations", "Status", "Severity", ""].map((h) => (
                          <TableCell key={h} isHeader className={TH}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody className={TBODY}>
                      {selected.openAlerts.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className={cn(TD, "whitespace-nowrap")}>{formatTimestamp(a.alertDate)}</TableCell>
                          <TableCell className={TD}>{a.deviationCount}</TableCell>
                          <TableCell className={TD}>
                            <XBadge color={ALERT_STATUS_BADGE[a.status] ?? "gray"}>{a.status}</XBadge>
                          </TableCell>
                          <TableCell className={TD}>
                            <XBadge color={SEVERITY_BADGE[a.severity] ?? "gray"}>{a.severity}</XBadge>
                          </TableCell>
                          <TableCell className={TD}>
                            <button
                              type="button"
                              className="text-sm font-medium text-brand-500 hover:underline dark:text-brand-400"
                              onClick={() => navigate(`/deviation-report/${a.id}`)}
                            >
                              Open
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </div>
        )}
      </Dialog>
    </div>
  );
}

const TONE_CLASS = {
  default: "text-gray-800 dark:text-white/90",
  brand: "text-brand-500 dark:text-brand-400",
  success: "text-success-600 dark:text-success-500",
  error: "text-error-600 dark:text-error-500",
} as const;

function SoxStat({ label, value, note, tone = "default" }: { label: string; value: string | number; note: string; tone?: keyof typeof TONE_CLASS }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className={cn("text-title-sm font-bold", TONE_CLASS[tone])}>{value}</span>
      <span className="text-theme-xs text-gray-500 dark:text-gray-400">{note}</span>
    </div>
  );
}
