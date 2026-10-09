import EmptyState from "@/components/common/EmptyState";
import PageMeta from "@/components/common/PageMeta";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { notify } from "@/components/ui/toast/Toast";
import {
  Dialog,
  ErrorBanner,
  IconButton,
  Loading,
  PageHeader,
  SearchInput,
  SelectField,
  TableCard,
  TBODY,
  TD,
  TH,
  THEAD,
  Toggle,
  XBadge,
} from "@/components/xyra/kit";
import {
  type MappableControl,
  type MappableSystem,
  type SystemControlConfig as Mapping,
  systemControlConfigApi,
} from "@/lib/api-client";
import { FREQ_BE_TO_UI } from "@/lib/control-frequency";
import { Play, Plus, SearchLg, Trash01 } from "@untitledui/icons";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

const SEVERITY_BADGE_COLOR: Record<string, "error" | "warning" | "success"> = { HIGH: "error", MEDIUM: "warning", LOW: "success" };
const titleCase = (s: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : "");

export default function SystemControlConfig() {
  const navigate = useNavigate();
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [mappable, setMappable] = useState<{ controls: MappableControl[]; systems: MappableSystem[] }>({ controls: [], systems: [] });
  const [selectedControlId, setSelectedControlId] = useState("");
  const [selectedSystemId, setSelectedSystemId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<Mapping | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = () => {
    setIsLoading(true);
    systemControlConfigApi
      .list()
      .then((res) => {
        if (!res.success) {
          setError(res.message || "Could not load system control config.");
          return;
        }
        setError(null);
        setMappings(res.configs);
      })
      .catch(() => setError("Could not reach the server. Is xyra-core running?"))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mappings;
    return mappings.filter((m) => [m.controlCode, m.controlDescription, m.systemCode].join(" ").toLowerCase().includes(q));
  }, [mappings, query]);

  const openAdd = () => {
    setSelectedControlId("");
    setSelectedSystemId("");
    setError(null);
    setIsAddOpen(true);
    systemControlConfigApi
      .listMappable()
      .then((res) => {
        if (!res.success) {
          setError(res.message || "Could not load controls/systems.");
          return;
        }
        setMappable({ controls: res.controls, systems: res.systems });
      })
      .catch(() => setError("Could not reach the server. Is xyra-core running?"));
  };

  const selectedControl = mappable.controls.find((c) => c.id === selectedControlId);
  const selectedSystem = mappable.systems.find((s) => s.id === selectedSystemId);

  const onSaveMapping = async () => {
    if (!selectedControlId || !selectedSystemId) {
      setError("Please select both a Control and a System.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await systemControlConfigApi.create(selectedControlId, selectedSystemId);
      if (!res.success) {
        setError(res.message || "Could not save this mapping.");
        return;
      }
      setIsAddOpen(false);
      load();
    } catch {
      setError("Could not reach the server. Is xyra-core running?");
    } finally {
      setIsSaving(false);
    }
  };

  // Optimistic: flip the switch immediately, run the request in the
  // background, and only roll it back if the backend actually rejects it.
  const onToggleStatus = async (m: Mapping) => {
    const nextEnabled = !m.enabled;
    setMappings((prev) => prev.map((x) => (x.id === m.id ? { ...x, enabled: nextEnabled } : x)));
    setBusyId(m.id);
    try {
      const res = await systemControlConfigApi.setStatus(m.id, nextEnabled);
      if (res.success) {
        notify("success", `${m.controlCode} on ${m.systemCode} ${nextEnabled ? "activated" : "deactivated"}.`);
      } else {
        setMappings((prev) => prev.map((x) => (x.id === m.id ? { ...x, enabled: m.enabled } : x)));
        notify("error", res.message || "Could not update status.");
      }
    } catch {
      setMappings((prev) => prev.map((x) => (x.id === m.id ? { ...x, enabled: m.enabled } : x)));
      notify("error", "Could not reach the server. Is xyra-core running?");
    } finally {
      setBusyId(null);
    }
  };

  const onConfirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const res = await systemControlConfigApi.remove(pendingDelete.id);
      if (!res.success) {
        notify("error", res.message || "Could not delete this mapping.");
        return;
      }
      setMappings((prev) => prev.filter((x) => x.id !== pendingDelete.id));
      notify("success", `${pendingDelete.controlCode} will no longer run on ${pendingDelete.systemCode}.`);
      setPendingDelete(null);
    } catch {
      notify("error", "Could not reach the server. Is xyra-core running?");
    } finally {
      setIsDeleting(false);
    }
  };

  const onRunNow = async (m: Mapping) => {
    setBusyId(m.id);
    try {
      const res = await systemControlConfigApi.runNow(m.id);
      if (res.success) load();
      else setError(res.message || "Run failed.");
    } catch {
      setError("Could not reach the server to run this control.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title="System Control Config | Xyra" description="Map controls to systems" />
      <PageHeader
        crumbs={["Control Management", "System Control Config"]}
        title="System Control Config"
        description="Map each Control to the Systems it should run on, and activate or deactivate that mapping."
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <TableCard
        title="Control ↔ System Mappings"
        count={filtered.length}
        actions={
          <>
            <SearchInput value={query} onChange={setQuery} />
            <Button size="sm" startIcon={<Plus className="size-4" />} onClick={openAdd}>
              Add
            </Button>
          </>
        }
      >
        {isLoading ? (
          <Loading label="Loading mappings…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={SearchLg}
            title={query ? "No matching mappings" : "No mappings yet"}
            description={query ? "Try a different search term." : "Click Add to map a control to a system."}
          />
        ) : (
          <Table>
            <TableHeader className={THEAD}>
              <TableRow>
                <TableCell isHeader className={TH}>Control ID</TableCell>
                <TableCell isHeader className={TH}>Description</TableCell>
                <TableCell isHeader className={TH}>System</TableCell>
                <TableCell isHeader className={TH}>Severity</TableCell>
                <TableCell isHeader className={TH}>Frequency</TableCell>
                <TableCell isHeader className={TH}>Status</TableCell>
                <TableCell isHeader className={TH}>Runs Completed</TableCell>
                <TableCell isHeader className={TH}>Actions</TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className={TBODY}>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className={TD}>
                    <button
                      type="button"
                      className="font-medium text-brand-500 hover:underline dark:text-brand-400"
                      onClick={() => navigate(`/system-control-config/${m.id}`)}
                    >
                      {m.controlCode}
                    </button>
                  </TableCell>
                  <TableCell className={TD}>{m.controlDescription}</TableCell>
                  <TableCell className={TD}>
                    {m.systemCode}/{m.systemClient}
                  </TableCell>
                  <TableCell className={TD}>
                    <XBadge color={SEVERITY_BADGE_COLOR[m.controlSeverity] ?? "gray"}>{titleCase(m.controlSeverity)}</XBadge>
                  </TableCell>
                  <TableCell className={TD}>{FREQ_BE_TO_UI[m.controlFrequency] || m.controlFrequency}</TableCell>
                  <TableCell className={TD}>
                    <XBadge color={m.enabled ? "success" : "gray"}>{m.enabled ? "Active" : "Inactive"}</XBadge>
                  </TableCell>
                  <TableCell className={TD}>{m.runCount}</TableCell>
                  <TableCell className={TD}>
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        icon={Play}
                        title="Run Now"
                        disabled={!m.enabled || busyId === m.id}
                        onClick={() => onRunNow(m)}
                      />
                      <div
                        className="flex px-1.5"
                        title={
                          m.enabled
                            ? "Active — click to deactivate (stops scheduled runs on this system)"
                            : "Inactive — click to activate (resumes scheduled runs on this system)"
                        }
                      >
                        <Toggle checked={m.enabled} onChange={() => onToggleStatus(m)} />
                      </div>
                      <IconButton
                        icon={Trash01}
                        title="Delete Mapping"
                        danger
                        disabled={busyId === m.id}
                        onClick={() => setPendingDelete(m)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <Dialog
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Map Control to System"
        description="Pick a Control and a System — the control will run against that system starting from its next scheduled run."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={isSaving} onClick={onSaveMapping}>
              Save Mapping
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <SelectField
            label="Control"
            required
            placeholder="Select control"
            value={selectedControlId}
            onChange={setSelectedControlId}
            options={mappable.controls.map((c) => ({ value: c.id, label: `${c.code} — ${c.description}` }))}
          />
          <SelectField
            label="System"
            required
            placeholder="Select system"
            value={selectedSystemId}
            onChange={setSelectedSystemId}
            options={mappable.systems.map((s) => ({ value: s.id, label: `${s.sysId} (Client ${s.client})` }))}
          />
          {selectedControl && selectedSystem && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/3">
              <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                {selectedControl.code} will run on {selectedSystem.sysId}/{selectedSystem.client} every{" "}
                {(FREQ_BE_TO_UI[selectedControl.frequency] || selectedControl.frequency).toLowerCase()}.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Status on save:</span>
                <XBadge color="success">Active</XBadge>
              </div>
            </div>
          )}
        </div>
      </Dialog>

      <Dialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        size="sm"
        title="Delete Control Mapping"
        description={
          <>
            Delete the mapping of <span className="font-semibold text-gray-800 dark:text-white/90">{pendingDelete?.controlCode}</span>{" "}
            on{" "}
            <span className="font-semibold text-gray-800 dark:text-white/90">
              {pendingDelete?.systemCode}/{pendingDelete?.systemClient}
            </span>
            ? The control will stop running on this system. The control itself and all past run history, deviations and logs are kept.
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
    </div>
  );
}
