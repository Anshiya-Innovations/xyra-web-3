import PageMeta from "@/components/common/PageMeta";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DonutChart } from "@/components/xyra/charts";
import { type BadgeColors, Card, ErrorBanner, Loading, StatCard, TableCard, TBODY, TD, TH, THEAD, XBadge } from "@/components/xyra/kit";
import {
  type AlertHeader,
  type Control,
  type DeviationKpi,
  type SystemEntry,
  controlApi,
  deviationApi,
  reviewApi,
  systemConfigApi,
} from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { cn } from "@/utils";
import { AlertTriangle, CheckCircle, Server01, Shield01 } from "@untitledui/icons";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

const SEVERITY_COLORS: Record<string, string> = { LOW: "#12B76A", MEDIUM: "#F79009", HIGH: "#F04438" };
const SEVERITY_BADGE_COLOR: Record<string, BadgeColors> = { HIGH: "error", MEDIUM: "warning", LOW: "success" };
const STATUS_BADGE_COLOR: Record<string, BadgeColors> = { Open: "error", "In Progress": "warning", Resolved: "success" };
const titleCase = (s: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : "");

const EMPTY_FILTERS = {
  organizationId: "All",
  sector: "All",
  region: "All",
  platform: "All",
  systemId: "All",
  client: "All",
  controlId: "All",
  status: "All",
  startDate: "",
  endDate: "",
};

const DEFAULT_KPI: DeviationKpi = { totalIncidents: 0, openItems: 0, resolvedItems: 0, auditedControls: 0, complianceRate: "0%" };

export default function Dashboard() {
  const navigate = useNavigate();
  const session = getSession();

  const [controls, setControls] = useState<Control[]>([]);
  const [systems, setSystems] = useState<SystemEntry[]>([]);
  const [deviations, setDeviations] = useState<AlertHeader[]>([]);
  const [kpi, setKpi] = useState<DeviationKpi>(DEFAULT_KPI);
  const [pipeline, setPipeline] = useState({ level1Pending: 0, level2Pending: 0, ticketsCreated: 0, ticketsInProgress: 0, ticketsResolved: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      controlApi.list(),
      systemConfigApi.list(),
      deviationApi.list(EMPTY_FILTERS),
      reviewApi.listLevel1Queue(),
      reviewApi.listLevel2Queue(),
      reviewApi.listLevel1History(),
      reviewApi.listLevel2History(),
    ])
      .then(([controlsRes, systemsRes, deviationsRes, l1qRes, l2qRes, l1hRes, l2hRes]) => {
        if (controlsRes.success) setControls(controlsRes.controls);
        if (systemsRes.success) setSystems(systemsRes.systems);
        if (deviationsRes.success) {
          setDeviations(deviationsRes.headers);
          setKpi(deviationsRes.kpi);
        }
        // Same "Review Pipeline" widget as xyra-web's Admin dashboard - queue
        // length per level, plus how many history rows (either level) ever got
        // a remediation ticket, split into in-progress vs resolved.
        // ticketResolved is set by lib/ticketing/jiraSync's poller once Jira
        // reports the issue done (STUB tickets never resolve).
        type TicketRow = { ticketNumber: string; ticketResolved: boolean };
        const countCreated = (rows: TicketRow[]) => rows.filter((r) => r.ticketNumber).length;
        const countInProgress = (rows: TicketRow[]) => rows.filter((r) => r.ticketNumber && !r.ticketResolved).length;
        const countResolved = (rows: TicketRow[]) => rows.filter((r) => r.ticketResolved).length;
        setPipeline({
          level1Pending: l1qRes.success ? l1qRes.reviews.length : 0,
          level2Pending: l2qRes.success ? l2qRes.reviews.length : 0,
          ticketsCreated: (l1hRes.success ? countCreated(l1hRes.reviews) : 0) + (l2hRes.success ? countCreated(l2hRes.reviews) : 0),
          ticketsInProgress:
            (l1hRes.success ? countInProgress(l1hRes.reviews) : 0) + (l2hRes.success ? countInProgress(l2hRes.reviews) : 0),
          ticketsResolved: (l1hRes.success ? countResolved(l1hRes.reviews) : 0) + (l2hRes.success ? countResolved(l2hRes.reviews) : 0),
        });
      })
      .catch(() => setError("Could not reach the server. Is xyra-core running?"))
      .finally(() => setIsLoading(false));
  }, []);

  const activeControls = controls.filter((c) => c.enabled).length;

  const severityData = useMemo(() => {
    const counts: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    controls.forEach((c) => {
      counts[c.severity] = (counts[c.severity] || 0) + 1;
    });
    return ["LOW", "MEDIUM", "HIGH"].filter((k) => counts[k] > 0).map((k) => ({ key: k, name: titleCase(k), value: counts[k] }));
  }, [controls]);

  const pipelineRows = useMemo(() => {
    const rows = [
      { label: "Level 1 Pending", value: pipeline.level1Pending, color: "bg-error-500" },
      { label: "Level 2 Pending", value: pipeline.level2Pending, color: "bg-warning-500" },
      { label: "Tickets Created", value: pipeline.ticketsCreated, color: "bg-gray-500" },
      { label: "Tickets In Progress", value: pipeline.ticketsInProgress, color: "bg-brand-500" },
      { label: "Tickets Resolved", value: pipeline.ticketsResolved, color: "bg-success-500" },
    ];
    const max = Math.max(1, ...rows.map((r) => r.value));
    return rows.map((r) => ({ ...r, pct: Math.round((r.value / max) * 100) }));
  }, [pipeline]);

  const recentDeviations = useMemo(
    () => [...deviations].sort((a, b) => (b.alertDate || "").localeCompare(a.alertDate || "")).slice(0, 5),
    [deviations],
  );

  if (isLoading) return <Loading label="Loading dashboard…" />;

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title="Admin Dashboard | Xyra" description="Continuous Control Monitoring overview" />
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">
            Welcome back{session ? `, ${session.name}` : ""}
          </h2>
          {session && <XBadge color="brand">{session.role}</XBadge>}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Continuous Control Monitoring overview for your organization.</p>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
        <StatCard label="Open Deviations" value={kpi.openItems} icon={AlertTriangle} tone="error" />
        <StatCard label="Compliance Rate" value={kpi.complianceRate} icon={CheckCircle} tone="success" />
        <StatCard label="Systems Monitored" value={systems.length} icon={Server01} tone="brand" />
        <StatCard label="Active / Total Controls" value={`${activeControls}/${controls.length}`} icon={Shield01} tone="brand" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Control Severity Distribution" description="How your controls are weighted">
          {severityData.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">No controls yet.</p>
          ) : (
            <DonutChart
              labels={severityData.map((d) => d.name)}
              series={severityData.map((d) => d.value)}
              colors={severityData.map((d) => SEVERITY_COLORS[d.key])}
            />
          )}
        </Card>

        <Card title="Deviation Summary" description="Tenant-wide incident totals">
          <div className="flex flex-col gap-3">
            <SummaryRow label="Total Incidents" value={kpi.totalIncidents} color="error" />
            <SummaryRow label="Open Items" value={kpi.openItems} color="warning" />
            <SummaryRow label="Resolved Items" value={kpi.resolvedItems} color="success" />
            <SummaryRow label="Audited Controls" value={kpi.auditedControls} color="gray" />
            <SummaryRow label="Compliance Rate" value={kpi.complianceRate} color="success" last />
          </div>
        </Card>

        <Card title="Review Pipeline" description="Level 1/2 review queues & remediation tickets">
          <div className="flex flex-col gap-4">
            {pipelineRows.map((row) => (
              <div key={row.label} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{row.label}</span>
                  <span className="font-semibold text-gray-800 dark:text-white/90">{row.value}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                  <div className={cn("h-full rounded-full transition-all", row.color)} style={{ width: `${row.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <TableCard title="Recent Deviations" description="The 5 most recent alerts across every control">
        {recentDeviations.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No deviations recorded yet.</p>
        ) : (
          <Table>
            <TableHeader className={THEAD}>
              <TableRow>
                {["Control ID", "System", "Severity", "Status", "Alert Date"].map((h) => (
                  <TableCell key={h} isHeader className={TH}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className={TBODY}>
              {recentDeviations.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className={TD}>
                    <button
                      type="button"
                      className="font-medium text-brand-500 hover:underline dark:text-brand-400"
                      onClick={() => navigate(`/deviation-report/${h.id}`)}
                    >
                      {h.controlId}
                    </button>
                  </TableCell>
                  <TableCell className={TD}>{h.systemId}</TableCell>
                  <TableCell className={TD}>
                    <XBadge color={SEVERITY_BADGE_COLOR[h.severity.toUpperCase()] ?? "gray"}>{h.severity}</XBadge>
                  </TableCell>
                  <TableCell className={TD}>
                    <XBadge color={STATUS_BADGE_COLOR[h.status]}>{h.status}</XBadge>
                  </TableCell>
                  <TableCell className={cn(TD, "whitespace-nowrap")}>{h.alertDate ? new Date(h.alertDate).toLocaleString() : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>
    </div>
  );
}

function SummaryRow({ label, value, color, last }: { label: string; value: number | string; color: BadgeColors; last?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between pb-3", !last && "border-b border-gray-100 dark:border-gray-800")}>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <XBadge color={color}>{value}</XBadge>
    </div>
  );
}
