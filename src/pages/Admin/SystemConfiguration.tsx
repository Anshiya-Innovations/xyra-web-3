import EmptyState from "@/components/common/EmptyState";
import PageMeta from "@/components/common/PageMeta";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Tabs from "@/components/ui/tabs/Tabs";
import { notify } from "@/components/ui/toast/Toast";
import {
  type BadgeColors,
  Dialog,
  ErrorBanner,
  IconButton,
  InfoBanner,
  Loading,
  opts,
  PageHeader,
  SearchInput,
  SelectField,
  TableCard,
  TBODY,
  TD,
  TD_STRONG,
  TextField,
  TH,
  THEAD,
  Toggle,
  XBadge,
} from "@/components/xyra/kit";
import {
  type AuditLogEntry,
  type Organization,
  type SystemEntry,
  type SystemInput,
  auditLogApi,
  organizationApi,
  systemConfigApi,
} from "@/lib/api-client";
import { cn } from "@/utils";
import { Activity, ClockRewind, Edit01, Plus, RefreshCw01, SearchLg, Trash01 } from "@untitledui/icons";
import { useEffect, useMemo, useRef, useState } from "react";

const SYS_TYPE_OPTIONS = ["Development", "Quality", "Production"];
const CLIENT_TYPE_OPTIONS = ["ABAP", "JAVA", "S4/HANA"];

const SYS_TYPE_BADGE_COLOR: Record<string, BadgeColors> = { Production: "error", Quality: "warning" };

const SYSTEM_HISTORY_ACTION_LABELS: Record<string, string> = {
  SYSTEM_CREATE: "System Created",
  SYSTEM_UPDATE: "System Modified",
  SYSTEM_DELETE: "System Deleted",
};

type HealthStatus = "Online" | "Offline" | "Degraded" | "Unknown";

type HealthRow = {
  id: string;
  sysId: string;
  client: string;
  sysType: string;
  status: HealthStatus;
  lastCheck: string;
  connectionStatus: string;
  isDummy?: boolean;
};

const STATUS_BADGE_COLOR: Record<HealthStatus, BadgeColors> = { Online: "success", Offline: "error", Degraded: "warning", Unknown: "gray" };
const STATUS_HINT: Record<HealthStatus, string> = {
  Online: "Reachable, authenticated OK",
  Offline: "Unreachable or auth rejected",
  Degraded: "Reachable, high latency",
  Unknown: "No check run yet",
};

// Shown only when the tenant has zero Systems on file yet, so a fresh
// install's Health tab isn't blank - mirrors xyra-web's DUMMY_HEALTH_SYSTEMS.
const DUMMY_NOTE = "Example data — add a real system to test connectivity.";
const DUMMY_HEALTH_SYSTEMS: HealthRow[] = [
  { id: "dummy-1", isDummy: true, sysId: "MY8", client: "000", sysType: "Development", status: "Online", lastCheck: "—", connectionStatus: DUMMY_NOTE },
  { id: "dummy-2", isDummy: true, sysId: "MQ8", client: "100", sysType: "Quality", status: "Degraded", lastCheck: "—", connectionStatus: DUMMY_NOTE },
  { id: "dummy-3", isDummy: true, sysId: "MP8", client: "800", sysType: "Production", status: "Offline", lastCheck: "—", connectionStatus: DUMMY_NOTE },
  { id: "dummy-4", isDummy: true, sysId: "BW1", client: "100", sysType: "Production", status: "Unknown", lastCheck: "—", connectionStatus: DUMMY_NOTE },
];

const DEGRADED_LATENCY_MS = 1000;

type FormState = {
  sysId: string;
  client: string;
  organizationId: string;
  sysType: string;
  hostName: string;
  sysDetails: string;
  sector: string;
  platform: string;
  region: string;
  clientType: string;
  sysVersion: string;
  logonGroup: string;
  portNumber: string;
  instanceNo: string;
  endpoint: string;
  credUserId: string;
  credPassword: string;
};

const ADD_DEFAULTS: FormState = {
  sysId: "",
  client: "100",
  organizationId: "",
  sysType: "Quality",
  hostName: "",
  sysDetails: "",
  sector: "MedTech",
  platform: "USROTC",
  region: "North America",
  clientType: "ABAP",
  sysVersion: "750",
  logonGroup: "PUBLIC",
  portNumber: "3600",
  instanceNo: "00",
  endpoint: "",
  credUserId: "",
  credPassword: "",
};

function toFormState(sys: SystemEntry): FormState {
  return {
    sysId: sys.sysId,
    client: sys.client,
    organizationId: sys.organizationId,
    sysType: sys.sysType,
    hostName: sys.hostName,
    sysDetails: sys.sysDetails,
    sector: sys.sector,
    platform: sys.platform,
    region: sys.region,
    clientType: sys.clientType,
    sysVersion: sys.sysVersion,
    logonGroup: sys.logonGroup,
    portNumber: String(sys.portNumber ?? ""),
    instanceNo: sys.instanceNo,
    endpoint: sys.endpoint,
    credUserId: "",
    credPassword: "",
  };
}

function toSystemInput(form: FormState): SystemInput {
  return { ...form, portNumber: Number(form.portNumber) || 0 };
}

const nowFormatted = () => new Date().toLocaleString();

const STICKY = "sticky right-0 z-10 bg-white shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)] dark:bg-gray-900";

export default function SystemConfiguration() {
  const [activeTab, setActiveTab] = useState<"landscape" | "health">("landscape");
  const [systems, setSystems] = useState<SystemEntry[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showFeedback = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback((f) => (f?.text === text ? null : f)), 4000);
  };

  // LANDSCAPE state
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [form, setForm] = useState<FormState>(ADD_DEFAULTS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SystemEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<AuditLogEntry[]>([]);

  // HEALTH state
  const [health, setHealth] = useState<HealthRow[]>([]);
  const [healthQuery, setHealthQuery] = useState("");
  const [healthStatusFilter, setHealthStatusFilter] = useState<HealthStatus | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isRefreshingHealth, setIsRefreshingHealth] = useState(false);
  const autoRefreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    setIsLoading(true);
    systemConfigApi
      .list()
      .then((res) => {
        if (!res.success) {
          setError(res.message || "Could not load systems.");
          return;
        }
        setError(null);
        setSystems(res.systems);
      })
      .catch(() => setError("Could not reach the server. Is xyra-core running?"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
    organizationApi
      .list()
      .then((res) => res.success && setOrganizations(res.organizations))
      .catch(() => {});
  }, []);

  // Rebuilds the health table from the real Systems list - every row starts
  // "Unknown" until a real test has run against it, but keeps existing test
  // results for systems that were already checked. Falls back to
  // DUMMY_HEALTH_SYSTEMS when there are no systems.
  useEffect(() => {
    if (systems.length === 0) {
      setHealth(DUMMY_HEALTH_SYSTEMS.map((r) => ({ ...r })));
      return;
    }
    setHealth((prev) => {
      const existingById = new Map(prev.map((row) => [row.id, row]));
      return systems.map((sys) => {
        const existing = existingById.get(sys.id);
        return {
          id: sys.id,
          sysId: sys.sysId,
          client: sys.client,
          sysType: sys.sysType,
          status: existing?.status ?? "Unknown",
          lastCheck: existing?.lastCheck ?? "Never",
          connectionStatus: existing?.connectionStatus ?? "Not yet tested",
        };
      });
    });
  }, [systems]);

  useEffect(() => {
    return () => {
      if (autoRefreshInterval.current) clearInterval(autoRefreshInterval.current);
    };
  }, []);

  const filteredSystems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return systems;
    return systems.filter((s) => [s.sysId, s.hostName, s.sysType, s.sysDetails].join(" ").toLowerCase().includes(q));
  }, [systems, query]);

  const kpis = useMemo(() => {
    const counts = { Online: 0, Offline: 0, Degraded: 0, Unknown: 0 };
    health.forEach((row) => counts[row.status]++);
    return counts;
  }, [health]);

  const filteredHealth = useMemo(() => {
    const q = healthQuery.trim().toLowerCase();
    return health.filter((row) => {
      if (healthStatusFilter && row.status !== healthStatusFilter) return false;
      if (q && !`${row.sysId} ${row.sysType} ${row.connectionStatus}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [health, healthQuery, healthStatusFilter]);

  const isDummyData = health.length > 0 && health[0].isDummy === true;

  // One real connection test, shared by the Landscape row action and every
  // Health tab test (single/refresh/auto-refresh) - never duplicated.
  const runTest = async (id: string): Promise<{ success: boolean; message?: string; latencyMs?: number }> => {
    try {
      return await systemConfigApi.testConnection(id);
    } catch {
      return { success: false, message: "Could not reach xyra-core to run the test." };
    }
  };

  const applyHealthResult = (id: string, result: { success: boolean; message?: string; latencyMs?: number }) => {
    setHealth((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const status: HealthStatus = !result.success
          ? "Offline"
          : result.latencyMs != null && result.latencyMs >= DEGRADED_LATENCY_MS
            ? "Degraded"
            : "Online";
        return {
          ...row,
          status,
          lastCheck: nowFormatted(),
          connectionStatus: result.message || (result.success ? "OK" : "Connection test failed."),
        };
      }),
    );
  };

  const onTestLandscapeRow = async (sys: SystemEntry) => {
    setTestingId(sys.id);
    const result = await runTest(sys.id);
    setTestingId(null);
    const latency = result.latencyMs != null ? ` (${result.latencyMs}ms)` : "";
    if (result.success) notify("success", `Connection to ${sys.sysId} succeeded${latency}.`);
    else notify("error", (result.message || "Connection test failed.") + latency);
  };

  const onTestHealthRow = async (row: HealthRow) => {
    if (row.isDummy) {
      notify("error", "Showing example data — add a real system under System Landscape to run live checks.");
      return;
    }
    setTestingId(row.id);
    const result = await runTest(row.id);
    setTestingId(null);
    applyHealthResult(row.id, result);
    const latency = result.latencyMs != null ? ` (${result.latencyMs}ms)` : "";
    if (result.success) notify("success", `Connection to ${row.sysId} succeeded${latency}.`);
    else notify("error", (result.message || "Connection test failed.") + latency);
  };

  const refreshHealth = async (silent = false) => {
    if (isDummyData) {
      if (!silent) notify("error", "Showing example data — add a real system under System Landscape to run live checks.");
      return;
    }
    if (health.length === 0) return;
    setIsRefreshingHealth(true);
    const results = await Promise.all(health.map(async (row) => ({ id: row.id, result: await runTest(row.id) })));
    results.forEach(({ id, result }) => applyHealthResult(id, result));
    setIsRefreshingHealth(false);
    if (!silent) {
      const ok = results.filter((r) => r.result.success).length;
      notify(ok === results.length ? "success" : "error", `Connectivity check complete: ${ok}/${results.length} systems reachable.`);
    }
  };

  const onToggleAutoRefresh = (selected: boolean) => {
    setAutoRefresh(selected);
    if (selected) {
      showFeedback("success", "Auto Refresh Enabled (15s Interval)");
      autoRefreshInterval.current = setInterval(() => refreshHealth(true), 15000);
    } else {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
        autoRefreshInterval.current = null;
      }
      showFeedback("success", "Auto Refresh Disabled");
    }
  };

  const openAdd = () => {
    setFormMode("add");
    setForm(ADD_DEFAULTS);
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (sys: SystemEntry) => {
    setFormMode("edit");
    setForm(toFormState(sys));
    setEditingId(sys.id);
    setFormOpen(true);
  };

  const onSaveForm = async () => {
    if (!form.sysId || !form.client || !form.organizationId || !form.hostName) {
      showFeedback("error", "Please fill in mandatory fields: System ID, Client, Organization, and Host Name.");
      return;
    }
    setIsSaving(true);
    try {
      const res =
        formMode === "add"
          ? await systemConfigApi.create(toSystemInput(form))
          : await systemConfigApi.update(editingId as string, toSystemInput(form));
      if (!res.success) {
        showFeedback("error", res.message || "Could not save this system.");
        return;
      }
      setFormOpen(false);
      showFeedback("success", `SAP System '${form.sysId}' ${formMode === "add" ? "created" : "updated"} successfully!`);
      load();
    } catch {
      showFeedback("error", "Could not reach the server. Is xyra-core running?");
    } finally {
      setIsSaving(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const res = await systemConfigApi.delete(pendingDelete.id);
      if (!res.success) {
        showFeedback("error", res.message || "Could not delete system.");
        return;
      }
      showFeedback("success", `SAP System '${pendingDelete.sysId}' deleted.`);
      setPendingDelete(null);
      load();
    } catch {
      showFeedback("error", "Could not reach the server. Is xyra-core running?");
    } finally {
      setIsDeleting(false);
    }
  };

  const openHistory = () => {
    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    auditLogApi
      .list()
      .then((res) => {
        if (!res.success) {
          showFeedback("error", "Could not reach the server to load System History.");
          setHistoryEntries([]);
          return;
        }
        setHistoryEntries(res.logs.filter((l) => l.objectType === "System"));
      })
      .catch(() => {
        showFeedback("error", "Could not reach the server to load System History.");
        setHistoryEntries([]);
      })
      .finally(() => setIsHistoryLoading(false));
  };

  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title="System Configuration | Xyra" description="SAP system landscape configuration" />
      <PageHeader
        crumbs={["System Configuration"]}
        title="System Configuration"
        description="Manage and configure SAP S/4HANA & ERP System Landscape connections."
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}
      {feedback &&
        (feedback.type === "success" ? (
          <p className="rounded-lg border border-success-500/30 bg-success-50 px-4 py-3 text-sm text-success-600 dark:bg-success-500/15 dark:text-success-500">
            {feedback.text}
          </p>
        ) : (
          <ErrorBanner>{feedback.text}</ErrorBanner>
        ))}

      <div>
        <Tabs
          selected={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: "landscape", label: "System Landscape" },
            { id: "health", label: "System Health" },
          ]}
        />

        <div className="pt-6">
          {activeTab === "landscape" && (
            <TableCard
              title="SAP System Landscape"
              count={filteredSystems.length}
              actions={
                <>
                  <SearchInput placeholder="Search System ID / Host..." value={query} onChange={setQuery} />
                  <Button variant="outline" size="sm" startIcon={<ClockRewind className="size-4" />} onClick={openHistory}>
                    System History
                  </Button>
                  <Button size="sm" startIcon={<Plus className="size-4" />} onClick={openAdd}>
                    Add New System
                  </Button>
                </>
              }
            >
              {isLoading ? (
                <Loading label="Loading systems…" />
              ) : filteredSystems.length === 0 ? (
                <EmptyState
                  icon={SearchLg}
                  title={query ? "No matching systems" : "No systems yet"}
                  description={query ? "Try a different search term." : "Click Add New System to register one."}
                />
              ) : (
                <Table>
                  <TableHeader className={THEAD}>
                    <TableRow>
                      {[
                        "System ID",
                        "Client",
                        "Organization",
                        "System Type",
                        "Host Name",
                        "System Details",
                        "Sector",
                        "Platform",
                        "Region",
                        "Client Type",
                        "Version",
                        "Logon Group",
                      ].map((h) => (
                        <TableCell key={h} isHeader className={TH}>
                          {h}
                        </TableCell>
                      ))}
                      <TableCell isHeader className={cn(TH, STICKY)}> </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className={TBODY}>
                    {filteredSystems.map((sys) => (
                      <TableRow key={sys.id}>
                        <TableCell className={TD_STRONG}>{sys.sysId}</TableCell>
                        <TableCell className={TD}>{sys.client}</TableCell>
                        <TableCell className={TD}>{sys.organizationCode}</TableCell>
                        <TableCell className={TD}>
                          <XBadge color={SYS_TYPE_BADGE_COLOR[sys.sysType] ?? "brand"}>{sys.sysType}</XBadge>
                        </TableCell>
                        <TableCell className={TD}>{sys.hostName}</TableCell>
                        <TableCell className={cn(TD, "max-w-xs truncate")}>{sys.sysDetails}</TableCell>
                        <TableCell className={TD}>{sys.sector}</TableCell>
                        <TableCell className={TD}>{sys.platform}</TableCell>
                        <TableCell className={TD}>{sys.region}</TableCell>
                        <TableCell className={TD}>{sys.clientType}</TableCell>
                        <TableCell className={TD}>{sys.sysVersion}</TableCell>
                        <TableCell className={TD}>{sys.logonGroup}</TableCell>
                        <TableCell className={cn(TD, STICKY)}>
                          <div className="flex justify-end gap-1">
                            <IconButton
                              icon={Activity}
                              title="Test Connection"
                              disabled={testingId === sys.id}
                              onClick={() => onTestLandscapeRow(sys)}
                            />
                            <IconButton icon={Edit01} title="Edit System" onClick={() => openEdit(sys)} />
                            <IconButton icon={Trash01} title="Delete System" danger onClick={() => setPendingDelete(sys)} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TableCard>
          )}

          {activeTab === "health" && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">SAP Landscape Live Health & Telemetry</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Real-time availability, connection latency & status monitoring.</p>
                </div>
                <div className="flex items-center gap-4">
                  <Toggle label="Auto Refresh" checked={autoRefresh} onChange={onToggleAutoRefresh} />
                  <Button
                    size="sm"
                    startIcon={<RefreshCw01 className="size-4" />}
                    loading={isRefreshingHealth}
                    onClick={() => refreshHealth(false)}
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              {isDummyData && (
                <InfoBanner>
                  No systems configured yet — showing example data below. Add a system under System Landscape to see live health.
                </InfoBanner>
              )}

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {(["Online", "Offline", "Degraded", "Unknown"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setHealthStatusFilter((prev) => (prev === status ? null : status))}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-2xl border bg-white p-5 text-left transition dark:bg-white/3",
                      healthStatusFilter === status
                        ? "border-brand-500 ring-2 ring-brand-500/20"
                        : "border-gray-200 hover:border-gray-300 dark:border-gray-800",
                    )}
                  >
                    <span className="text-sm text-gray-500 dark:text-gray-400">{status} Systems</span>
                    <span className="text-title-sm font-bold text-gray-800 dark:text-white/90">{kpis[status]}</span>
                    <XBadge color={STATUS_BADGE_COLOR[status]}>{STATUS_HINT[status]}</XBadge>
                  </button>
                ))}
              </div>

              <TableCard
                title="SAP Landscape Runtime Health & Availability Matrix"
                actions={
                  <>
                    <SearchInput placeholder="Search System ID / Type..." value={healthQuery} onChange={setHealthQuery} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setHealthQuery("");
                        setHealthStatusFilter(null);
                      }}
                    >
                      Reset
                    </Button>
                  </>
                }
              >
                {filteredHealth.length === 0 ? (
                  <EmptyState icon={SearchLg} title="No systems match" description="Try a different search term or filter." />
                ) : (
                  <Table>
                    <TableHeader className={THEAD}>
                      <TableRow>
                        {["System ID", "System Type", "Client", "Status", "Last Health Check", "Connection Status"].map((h) => (
                          <TableCell key={h} isHeader className={TH}>
                            {h}
                          </TableCell>
                        ))}
                        <TableCell isHeader className={cn(TH, STICKY)}> </TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody className={TBODY}>
                      {filteredHealth.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className={TD_STRONG}>{row.sysId}</TableCell>
                          <TableCell className={TD}>
                            <XBadge color={SYS_TYPE_BADGE_COLOR[row.sysType] ?? "brand"}>{row.sysType}</XBadge>
                          </TableCell>
                          <TableCell className={TD}>{row.client}</TableCell>
                          <TableCell className={TD}>
                            <XBadge color={STATUS_BADGE_COLOR[row.status]}>{row.status}</XBadge>
                          </TableCell>
                          <TableCell className={cn(TD, "whitespace-nowrap")}>{row.lastCheck}</TableCell>
                          <TableCell className={cn(TD, "max-w-xs truncate")}>{row.connectionStatus}</TableCell>
                          <TableCell className={cn(TD, STICKY)}>
                            <div className="flex justify-end">
                              <IconButton
                                icon={Activity}
                                title="Test Connection"
                                disabled={testingId === row.id}
                                onClick={() => onTestHealthRow(row)}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableCard>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        size="xl"
        title={formMode === "add" ? "Add New SAP System Configuration" : "Edit SAP System Configuration"}
        description={
          formMode === "add"
            ? "Fill in SAP System connectivity and environment details below."
            : "Modify SAP System connectivity and environment details."
        }
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={isSaving} onClick={onSaveForm}>
              {formMode === "add" ? "Save System" : "Save Changes"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <div>
            <h5 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">System Identification</h5>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="System ID (SID)"
                required
                readOnly={formMode === "edit"}
                placeholder="e.g. MY8, MQ8, MP8"
                value={form.sysId}
                onChange={set("sysId")}
              />
              <TextField label="Client" required placeholder="e.g. 100, 000" value={form.client} onChange={set("client")} />
              <SelectField
                label="Organization"
                required
                placeholder="Select organization"
                value={form.organizationId}
                onChange={set("organizationId")}
                options={organizations.map((o) => ({ value: o.id, label: `${o.orgCode} - ${o.name}` }))}
              />
              <SelectField label="System Type" required value={form.sysType} onChange={set("sysType")} options={opts(SYS_TYPE_OPTIONS)} />
              <TextField label="Host Name" required placeholder="e.g. asmy800.xyra.com" value={form.hostName} onChange={set("hostName")} />
              <TextField label="System Details" placeholder="e.g. EHP4 FOR SAP CRM 7.0" value={form.sysDetails} onChange={set("sysDetails")} />
            </div>
          </div>

          <div>
            <h5 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">Environment & Network</h5>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="Sector" value={form.sector} onChange={set("sector")} />
              <TextField label="Platform" value={form.platform} onChange={set("platform")} />
              <TextField label="Region" value={form.region} onChange={set("region")} />
              <SelectField label="Client Type" value={form.clientType} onChange={set("clientType")} options={opts(CLIENT_TYPE_OPTIONS)} />
              <TextField label="System Version" value={form.sysVersion} onChange={set("sysVersion")} />
              <TextField label="Logon Group" value={form.logonGroup} onChange={set("logonGroup")} />
              <TextField label="Port Number" value={form.portNumber} onChange={set("portNumber")} />
              <TextField label="Instance Number" value={form.instanceNo} onChange={set("instanceNo")} />
            </div>
          </div>

          <div>
            <h5 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">Connection & Credentials</h5>
            {formMode === "edit" && (
              <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                Leave User ID / Password blank to keep the credentials already on file.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                className="sm:col-span-2"
                label="Endpoint (base URL)"
                placeholder="e.g. http://localhost:8000"
                value={form.endpoint}
                onChange={set("endpoint")}
              />
              <TextField label="User ID" placeholder="Basic Auth user" value={form.credUserId} onChange={set("credUserId")} />
              <TextField
                label="Password"
                type="password"
                placeholder="Basic Auth password"
                value={form.credPassword}
                onChange={set("credPassword")}
              />
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        size="sm"
        title="Delete SAP System"
        description={
          <>
            Are you sure you want to delete SAP System{" "}
            <span className="font-semibold text-gray-800 dark:text-white/90">{pendingDelete?.sysId}</span> (Client {pendingDelete?.client})?
          </>
        }
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" loading={isDeleting} onClick={onConfirmDelete}>
              Delete
            </Button>
          </>
        }
      />

      <Dialog
        open={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        size="lg"
        title="SAP System Landscape Audit History"
        footer={
          <Button variant="outline" size="sm" onClick={() => setIsHistoryOpen(false)}>
            Close
          </Button>
        }
      >
        {isHistoryLoading ? (
          <Loading label="Loading history…" />
        ) : historyEntries.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No system history recorded yet.</p>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className={THEAD}>
                <TableRow>
                  {["Timestamp", "Action Type", "System ID", "User", "Status"].map((h) => (
                    <TableCell key={h} isHeader className={TH}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className={TBODY}>
                {historyEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className={cn(TD, "whitespace-nowrap")}>
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className={TD}>{SYSTEM_HISTORY_ACTION_LABELS[entry.action] || entry.action}</TableCell>
                    <TableCell className={TD_STRONG}>{entry.systemId}</TableCell>
                    <TableCell className={TD}>{entry.performedBy}</TableCell>
                    <TableCell className={TD}>
                      <XBadge color={entry.result === "SUCCESS" ? "success" : "error"}>
                        {entry.result === "SUCCESS" ? "Success" : "Failure"}
                      </XBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Dialog>
    </div>
  );
}
