import EmptyState from "@/components/common/EmptyState";
import PageMeta from "@/components/common/PageMeta";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  ErrorBanner,
  IconButton,
  Loading,
  PageHeader,
  SearchInput,
  TableCard,
  TBODY,
  TD,
  TD_STRONG,
  TH,
  THEAD,
  XBadge,
} from "@/components/xyra/kit";
import { type Control, controlApi } from "@/lib/api-client";
import { calculateTotalRun, FREQ_BE_TO_UI } from "@/lib/control-frequency";
import { Edit01, Plus, SearchLg, Trash01 } from "@untitledui/icons";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

const SEVERITY_BADGE_COLOR: Record<string, "error" | "warning" | "success"> = {
  HIGH: "error",
  MEDIUM: "warning",
  LOW: "success",
};

function titleCase(s: string) {
  return s ? s.charAt(0) + s.slice(1).toLowerCase() : "";
}

export default function Controls() {
  const navigate = useNavigate();
  const [controls, setControls] = useState<Control[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Control | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setIsLoading(true);
    controlApi
      .list()
      .then((res) => {
        if (!res.success) {
          setError(res.message || "Could not load controls.");
          return;
        }
        setError(null);
        setControls(res.controls);
      })
      .catch(() => setError("Could not reach the server. Is xyra-core running?"))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return controls;
    return controls.filter((c) => [c.code, c.description, c.severity, c.controlType].join(" ").toLowerCase().includes(q));
  }, [controls, query]);

  const onConfirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const res = await controlApi.delete(pendingDelete.id);
      if (res.success) {
        setPendingDelete(null);
        load();
      } else {
        setError(res.message || "Could not delete control.");
      }
    } catch {
      setError("Could not reach the server. Is xyra-core running?");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title="Controls Config | Xyra" description="Security Control Master directory" />
      <PageHeader
        crumbs={["Control Management", "Controls Config"]}
        title="Controls Config"
        description="Security Control Master directory — rules, severity, and run frequency."
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <TableCard
        title="Security Control Master Directory"
        count={filtered.length}
        actions={
          <>
            <SearchInput placeholder="Search Control ID..." value={query} onChange={setQuery} />
            <Button size="sm" startIcon={<Plus className="size-4" />} onClick={() => navigate("/controls/new")}>
              Create Security Control
            </Button>
          </>
        }
      >
        {isLoading ? (
          <Loading label="Loading controls…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={SearchLg}
            title={query ? "No matching controls" : "No controls yet"}
            description={query ? "Try a different search term." : "Create your first Security Control to get started."}
          />
        ) : (
          <Table>
            <TableHeader className={THEAD}>
              <TableRow>
                <TableCell isHeader className={TH}>Control ID</TableCell>
                <TableCell isHeader className={TH}>Description</TableCell>
                <TableCell isHeader className={TH}>Severity</TableCell>
                <TableCell isHeader className={TH}>Control Type</TableCell>
                <TableCell isHeader className={TH}>Systems Mapped</TableCell>
                <TableCell isHeader className={TH}>Frequency</TableCell>
                <TableCell isHeader className={TH}>Total Run</TableCell>
                <TableCell isHeader className={TH}> </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className={TBODY}>
              {filtered.map((control) => {
                const freqUi = FREQ_BE_TO_UI[control.frequency] || "Daily";
                return (
                  <TableRow key={control.id}>
                    <TableCell className={TD_STRONG}>{control.code}</TableCell>
                    <TableCell className={TD}>{control.description}</TableCell>
                    <TableCell className={TD}>
                      <XBadge color={SEVERITY_BADGE_COLOR[control.severity] ?? "gray"}>{titleCase(control.severity)}</XBadge>
                    </TableCell>
                    <TableCell className={TD}>{titleCase(control.controlType)}</TableCell>
                    <TableCell className={TD}>
                      {control.systemIds.length} {control.systemIds.length === 1 ? "system" : "systems"}
                    </TableCell>
                    <TableCell className={TD}>{freqUi}</TableCell>
                    <TableCell className={TD}>{calculateTotalRun(freqUi, control.cronExpression)}</TableCell>
                    <TableCell className={TD}>
                      <div className="flex justify-end gap-1">
                        <IconButton icon={Edit01} title="Edit" onClick={() => navigate(`/controls/${control.id}`)} />
                        <IconButton icon={Trash01} title="Delete" danger onClick={() => setPendingDelete(control)} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <Dialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        size="sm"
        title="Delete Security Control"
        description={
          <>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-gray-800 dark:text-white/90">{pendingDelete?.code}</span>? This can't be undone.
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
