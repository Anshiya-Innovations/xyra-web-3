import PageMeta from "@/components/common/PageMeta";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { notify } from "@/components/ui/toast/Toast";
import { Card, DetailItem, Dialog, ErrorBanner, Loading, PageHeader, TBODY, TD, TH, THEAD, XBadge } from "@/components/xyra/kit";
import { type RunLog, type SystemControlConfig, systemControlConfigApi } from "@/lib/api-client";
import { FREQ_BE_TO_UI } from "@/lib/control-frequency";
import { ArrowLeft, CheckCircle, Play, Stop, Trash01 } from "@untitledui/icons";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

const SEVERITY_BADGE_COLOR: Record<string, "error" | "warning" | "success"> = { HIGH: "error", MEDIUM: "warning", LOW: "success" };
const LEVEL_BADGE_COLOR: Record<string, "error" | "warning" | "gray"> = { ERROR: "error", WARNING: "warning", INFO: "gray" };
const RUN_STATUS_COLOR: Record<string, "success" | "error" | "gray"> = { PASS: "success", FAIL: "error", ERROR: "error" };
const titleCase = (s: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : "");

type LogRow = RunLog & { id: string };

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function SystemControlConfigDetails() {
  const navigate = useNavigate();
  const { configId } = useParams();
  const [detail, setDetail] = useState<SystemControlConfig | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const load = () => {
    if (!configId) return;
    setIsLoading(true);
    systemControlConfigApi
      .getDetail(configId)
      .then((res) => {
        if (!res.success || !res.detail) {
          setError(res.message || "Could not load this mapping.");
          return;
        }
        setError(null);
        setDetail(res.detail);
        setLogs(res.logs.map((l, i) => ({ ...l, id: String(i) })));
      })
      .catch(() => setError("Could not reach the server. Is xyra-core running?"))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [configId]);

  const onToggleStatus = async () => {
    if (!detail) return;
    setIsBusy(true);
    try {
      const res = await systemControlConfigApi.setStatus(detail.id, !detail.enabled);
      if (res.success) load();
      else setError(res.message || "Could not update status.");
    } catch {
      setError("Could not reach the server. Is xyra-core running?");
    } finally {
      setIsBusy(false);
    }
  };

  const onRunNow = async () => {
    if (!detail) return;
    setIsBusy(true);
    try {
      const res = await systemControlConfigApi.runNow(detail.id);
      if (res.success) load();
      else setError(res.message || "Run failed.");
    } catch {
      setError("Could not reach the server to run this control.");
    } finally {
      setIsBusy(false);
    }
  };

  const onDelete = async () => {
    if (!detail) return;
    setIsBusy(true);
    try {
      const res = await systemControlConfigApi.remove(detail.id);
      if (!res.success) {
        setIsDeleteOpen(false);
        setError(res.message || "Could not delete this mapping.");
        return;
      }
      notify("success", `${detail.controlCode} will no longer run on ${detail.systemCode}.`);
      navigate("/system-control-config");
    } catch {
      setIsDeleteOpen(false);
      setError("Could not reach the server. Is xyra-core running?");
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading) return <Loading label="Loading mapping details…" />;

  if (!detail) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorBanner>{error || "Mapping not found."}</ErrorBanner>
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          startIcon={<ArrowLeft className="size-4" />}
          onClick={() => navigate("/system-control-config")}
        >
          Back to System Control Config
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title={`${detail.controlCode} on ${detail.systemCode} | Xyra`} description="Control mapping details" />
      <PageHeader
        crumbs={["Control Management", "System Control Config", `${detail.controlCode} on ${detail.systemCode}`]}
        onBack={() => navigate("/system-control-config")}
        title={`${detail.controlCode} on ${detail.systemCode}`}
        description="Lifecycle, run history and logs for this Control-to-System mapping."
        actions={
          <>
            <Button size="sm" startIcon={<Play className="size-4" />} disabled={!detail.enabled || isBusy} onClick={onRunNow}>
              Run Now
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={detail.enabled ? "text-error-600! ring-error-300!" : ""}
              startIcon={detail.enabled ? <Stop className="size-4" /> : <CheckCircle className="size-4" />}
              loading={isBusy}
              onClick={onToggleStatus}
            >
              {detail.enabled ? "Deactivate" : "Activate"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              startIcon={<Trash01 className="size-4" />}
              disabled={isBusy}
              onClick={() => setIsDeleteOpen(true)}
            >
              Delete
            </Button>
          </>
        }
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Card title="Mapping Overview">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <DetailItem label="Control">{`${detail.controlCode} — ${detail.controlDescription}`}</DetailItem>
          <DetailItem label="System">{`${detail.systemCode} / Client ${detail.systemClient}`}</DetailItem>
          <DetailItem label="Severity / Type">
            <span className="flex items-center gap-2">
              <XBadge color={SEVERITY_BADGE_COLOR[detail.controlSeverity] ?? "gray"}>{titleCase(detail.controlSeverity)}</XBadge>
              {titleCase(detail.controlType)}
            </span>
          </DetailItem>
          <DetailItem label="Status">
            <XBadge color={detail.enabled ? "success" : "gray"}>{detail.enabled ? "Active" : "Inactive"}</XBadge>
          </DetailItem>
          <DetailItem label="Frequency">{FREQ_BE_TO_UI[detail.controlFrequency] || detail.controlFrequency}</DetailItem>
          <DetailItem label="Created On">{formatTimestamp(detail.createdAt)}</DetailItem>
          <DetailItem label="Stopped On">{formatTimestamp(detail.deactivatedAt)}</DetailItem>
        </div>
      </Card>

      <Card title="Run History">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <div className="text-theme-xs text-gray-500 dark:text-gray-400">Runs Completed</div>
            <div className="mt-1 text-title-sm font-semibold text-gray-800 dark:text-white/90">{detail.runCount}</div>
          </div>
          <div>
            <div className="text-theme-xs text-gray-500 dark:text-gray-400">Last Run</div>
            <div className="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">
              {detail.lastRunAt ? formatTimestamp(detail.lastRunAt) : "Never run yet"}
            </div>
          </div>
          <div>
            <div className="text-theme-xs text-gray-500 dark:text-gray-400">Last Run Status</div>
            <div className="mt-1">
              <XBadge color={RUN_STATUS_COLOR[detail.lastRunStatus] ?? "gray"}>{detail.lastRunStatus || "—"}</XBadge>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Recent Run Logs" bodyClassName="p-0 sm:p-0">
        {logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No run logs yet for this mapping.</p>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className={THEAD}>
                <TableRow>
                  <TableCell isHeader className={TH}>Timestamp</TableCell>
                  <TableCell isHeader className={TH}>Level</TableCell>
                  <TableCell isHeader className={TH}>Message</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className={TBODY}>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className={`${TD} whitespace-nowrap`}>{formatTimestamp(log.timestamp)}</TableCell>
                    <TableCell className={TD}>
                      <XBadge color={LEVEL_BADGE_COLOR[log.level] ?? "gray"}>{log.level}</XBadge>
                    </TableCell>
                    <TableCell className={TD}>{log.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog
        open={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        size="sm"
        title="Delete Control Mapping"
        description={
          <>
            Delete the mapping of <span className="font-semibold text-gray-800 dark:text-white/90">{detail.controlCode}</span> on{" "}
            <span className="font-semibold text-gray-800 dark:text-white/90">
              {detail.systemCode}/{detail.systemClient}
            </span>
            ? The control will stop running on this system. The control itself and all past run history, deviations and logs are kept.
          </>
        }
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" loading={isBusy} onClick={onDelete}>
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}
