import EmptyState from "@/components/common/EmptyState";
import PageMeta from "@/components/common/PageMeta";
import Button from "@/components/ui/button/Button";
import Pagination from "@/components/ui/pagination/Pagination";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, DonutChart, LineChart } from "@/components/xyra/charts";
import {
  type BadgeColors,
  Card,
  type DateRange,
  DateRangeField,
  ErrorBanner,
  KpiTile,
  Loading,
  type Option,
  PageHeader,
  SelectField,
  TableCard,
  TBODY,
  TD,
  TH,
  THEAD,
  XBadge,
  ymd,
} from "@/components/xyra/kit";
import {
  type AlertHeader,
  type DeviationKpi,
  type Organization,
  type SystemEntry,
  controlApi,
  deviationApi,
  organizationApi,
  systemConfigApi,
} from "@/lib/api-client";
import { groupByDay, topByControl } from "@/lib/deviation-charts";
import { cn } from "@/utils";
import { RefreshCw01, SearchLg } from "@untitledui/icons";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

const PAGE_SIZE = 10;

// Status colors are reserved semantics (TailAdmin error/warning/success).
const STATUS_COLORS = { Open: "#F04438", "In Progress": "#F79009", Resolved: "#12B76A" } as const;
const SEVERITY_BADGE_COLOR: Record<string, BadgeColors> = { critical: "error", high: "error", medium: "warning", low: "success" };
const STATUS_BADGE_COLOR: Record<string, BadgeColors> = { Open: "error", "In Progress": "warning", Resolved: "success" };

const ALL: Option = { value: "All", label: "All" };

type Filters = {
  organizationId: string;
  sector: string;
  region: string;
  platform: string;
  systemId: string;
  client: string;
  controlId: string;
  status: string;
  startDate: string;
  endDate: string;
};

const DEFAULT_FILTERS: Filters = {
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

export default function DeviationReport() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [headers, setHeaders] = useState<AlertHeader[]>([]);
  const [kpi, setKpi] = useState<DeviationKpi>({ totalIncidents: 0, openItems: 0, resolvedItems: 0, auditedControls: 0, complianceRate: "0%" });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [allSystems, setAllSystems] = useState<SystemEntry[]>([]);
  const [controlOptions, setControlOptions] = useState<Option[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [page, setPage] = useState(1);

  // Loaded once - Organization narrows the System select; Region/Platform/
  // Sector/Client are independent facets derived from the (possibly
  // org-narrowed) systems list - matches xyra-web's DeviationReport.controller.js.
  useEffect(() => {
    organizationApi
      .list()
      .then((res) => res.success && setOrganizations(res.organizations))
      .catch(() => {});
    systemConfigApi
      .list()
      .then((res) => res.success && setAllSystems(res.systems))
      .catch(() => {});
    controlApi
      .list()
      .then((res) => res.success && setControlOptions(res.controls.map((c) => ({ value: c.code, label: `${c.code} - ${c.description}` }))))
      .catch(() => {});
  }, []);

  const scopedSystems = useMemo(
    () => (filters.organizationId === "All" ? allSystems : allSystems.filter((s) => s.organizationId === filters.organizationId)),
    [allSystems, filters.organizationId],
  );

  const runQuery = () => {
    setIsLoading(true);
    deviationApi
      .list(filters)
      .then((res) => {
        if (!res.success) {
          setError(res.message || "Could not load the deviation report.");
          return;
        }
        setError(null);
        setHeaders(res.headers);
        setKpi(res.kpi);
        setPage(1);
      })
      .catch(() => setError("Could not reach the server. Is xyra-core running?"))
      .finally(() => setIsLoading(false));
  };

  useEffect(runQuery, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onOrganizationChange = (organizationId: string) => setFilters({ ...DEFAULT_FILTERS, organizationId });

  const onReset = () => {
    setFilters(DEFAULT_FILTERS);
    setDateRange(null);
  };

  const set = (key: keyof Filters) => (value: string) => setFilters((f) => ({ ...f, [key]: value }));

  // The backend (and Filters) want plain "yyyy-MM-dd" strings.
  const onDateRangeChange = (range: DateRange | null) => {
    setDateRange(range);
    setFilters((f) => ({ ...f, startDate: range ? ymd(range.start) : "", endDate: range ? ymd(range.end) : "" }));
  };

  // Backend's toDisplayStatus collapses incidentStatus into exactly 3
  // mutually-exclusive buckets, so the donut's segments sum to the whole.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { Open: 0, "In Progress": 0, Resolved: 0 };
    headers.forEach((h) => {
      counts[h.status] = (counts[h.status] || 0) + 1;
    });
    return counts;
  }, [headers]);

  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    headers.forEach((h) => {
      const key = (h.severity || "").toLowerCase();
      if (key in counts) counts[key] += 1;
    });
    return counts;
  }, [headers]);

  const donut = (Object.keys(STATUS_COLORS) as (keyof typeof STATUS_COLORS)[]).filter((s) => statusCounts[s] > 0);
  const trendData = useMemo(() => groupByDay(headers), [headers]);
  const byControlData = useMemo(() => topByControl(headers), [headers]);

  const totalPages = Math.max(1, Math.ceil(headers.length / PAGE_SIZE));
  const pagedHeaders = headers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title="Deviation Report | Xyra" description="Detailed analysis of control deviations" />
      <PageHeader
        crumbs={["Control Management", "Deviation Report"]}
        title="Deviation Report"
        description="Detailed analysis of control deviations."
        actions={
          <Button variant="outline" size="sm" startIcon={<RefreshCw01 className="size-4" />} onClick={runQuery}>
            Refresh
          </Button>
        }
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Card
        title="Filter Criteria"
        actions={
          <Button variant="outline" size="sm" onClick={onReset}>
            Reset
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            label="Organization"
            value={filters.organizationId}
            onChange={onOrganizationChange}
            options={[ALL, ...organizations.map((o) => ({ value: o.id, label: `${o.orgCode} - ${o.name}` }))]}
          />
          <SelectField
            label="System"
            value={filters.systemId}
            onChange={set("systemId")}
            options={[ALL, ...scopedSystems.map((s) => ({ value: s.sysId, label: s.sysId }))]}
          />
          <SelectField label="Client" value={filters.client} onChange={set("client")} options={[ALL, ...distinctOptions(scopedSystems, (s) => s.client)]} />
          <SelectField label="Region" value={filters.region} onChange={set("region")} options={[ALL, ...distinctOptions(scopedSystems, (s) => s.region)]} />
          <SelectField
            label="Platform"
            value={filters.platform}
            onChange={set("platform")}
            options={[ALL, ...distinctOptions(scopedSystems, (s) => s.platform)]}
          />
          <SelectField label="Sector" value={filters.sector} onChange={set("sector")} options={[ALL, ...distinctOptions(scopedSystems, (s) => s.sector)]} />
          <SelectField label="Control" value={filters.controlId} onChange={set("controlId")} options={[ALL, ...controlOptions]} />
          <SelectField
            label="Incident Status"
            value={filters.status}
            onChange={set("status")}
            options={[ALL, { value: "Open", label: "Open" }, { value: "In Progress", label: "In Progress" }, { value: "Resolved", label: "Resolved" }]}
          />
          <DateRangeField className="sm:col-span-2" label="Date Range" value={dateRange} onChange={onDateRangeChange} />
        </div>
        <div className="mt-5 flex justify-end">
          <Button size="sm" startIcon={<SearchLg className="size-4" />} onClick={runQuery}>
            Search
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <Loading label="Loading deviation report…" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiTile label="Total Incidents" value={kpi.totalIncidents} hint="Control Deviations" color="error" />
            <KpiTile label="Open Items" value={kpi.openItems} hint="Requires Remediation" color="warning" />
            <KpiTile label="Resolved Items" value={kpi.resolvedItems} hint="Remediated & Closed" color="success" />
            <KpiTile label="Audited Controls" value={kpi.auditedControls} hint={`Resolution Rate: ${kpi.complianceRate}`} color="brand" />
          </div>

          {headers.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
              <EmptyState icon={SearchLg} title="No deviations found" description="No control deviations match your selected filter criteria." />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card title="Deviation Status Distribution" description="Categorized incident breakdown">
                  <DonutChart labels={donut} series={donut.map((s) => statusCounts[s])} colors={donut.map((s) => STATUS_COLORS[s])} />
                </Card>
                <Card title="Alert Summary" description="Severity breakdown of detected deviations">
                  <div className="flex flex-col gap-3">
                    {(["critical", "high", "medium", "low"] as const).map((key) => (
                      <div
                        key={key}
                        className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 dark:border-gray-800"
                      >
                        <span className="text-sm font-medium text-gray-800 capitalize dark:text-white/90">{key}</span>
                        <XBadge color={SEVERITY_BADGE_COLOR[key]}>{severityCounts[key]}</XBadge>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card title="Incident Trend" description="Deviations detected per day">
                  <LineChart name="Incidents" categories={trendData.map((d) => d.day)} data={trendData.map((d) => d.count)} />
                </Card>
                <Card title="Deviations by Control" description="Top controls by deviation count">
                  <BarChart name="Deviations" categories={byControlData.map((d) => d.controlId)} data={byControlData.map((d) => d.count)} />
                </Card>
              </div>

              <TableCard
                title="Deviation Alerts"
                count={headers.length}
                footer={<Pagination page={page} total={totalPages} onPageChange={setPage} />}
              >
                <Table>
                  <TableHeader className={THEAD}>
                    <TableRow>
                      {["Control ID", "System", "Client", "Incident Status", "Deviation Count", "Alert Date"].map((h) => (
                        <TableCell key={h} isHeader className={TH}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody className={TBODY}>
                    {pagedHeaders.map((h) => (
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
                        <TableCell className={TD}>{h.client}</TableCell>
                        <TableCell className={TD}>
                          <XBadge color={STATUS_BADGE_COLOR[h.status]}>{h.status}</XBadge>
                        </TableCell>
                        <TableCell className={TD}>{h.deviationCount} deviations</TableCell>
                        <TableCell className={cn(TD, "whitespace-nowrap")}>{h.alertDate ? new Date(h.alertDate).toLocaleString() : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            </>
          )}
        </>
      )}
    </div>
  );
}

