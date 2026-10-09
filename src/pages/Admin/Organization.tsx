import EmptyState from "@/components/common/EmptyState";
import PageMeta from "@/components/common/PageMeta";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { notify } from "@/components/ui/toast/Toast";
import {
  type BadgeColors,
  Dialog,
  ErrorBanner,
  Loading,
  opts,
  PageHeader,
  SearchInput,
  SelectField,
  TableCard,
  TBODY,
  TD,
  TextField,
  TH,
  THEAD,
  XBadge,
} from "@/components/xyra/kit";
import { type OrgInput, type Organization as Org, organizationApi } from "@/lib/api-client";
import { Plus, SearchLg } from "@untitledui/icons";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

const INDUSTRY_OPTIONS = [
  "Conglomerate & Technology",
  "IT Consulting & Services",
  "Enterprise Software",
  "Manufacturing & Automotive",
  "Banking & Financial Services",
  "Energy & Retail",
  "Healthcare & Pharmaceuticals",
  "Custom",
];

const REGION_OPTIONS = [
  { value: "Asia Pacific", label: "Asia Pacific (APAC)" },
  { value: "North America", label: "North America (NA)" },
  { value: "Europe", label: "Europe (EMEA)" },
  { value: "Latin America", label: "Latin America (LATAM)" },
  { value: "Middle East & Africa", label: "Middle East & Africa (MEA)" },
];

const STATUS_OPTIONS = ["Active", "Pending Setup", "Inactive"];

const STATUS_BADGE_COLOR: Record<string, BadgeColors> = {
  "Pending Setup": "warning",
  "Under Audit Review": "brand",
  Inactive: "error",
};

const DEFAULT_FORM: OrgInput = {
  orgCode: "",
  name: "",
  industry: "Conglomerate & Technology",
  region: "Asia Pacific",
  country: "",
  primaryContact: "",
  email: "",
  phone: "",
  status: "Active",
};

export default function Organization() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [regionFilter, setRegionFilter] = useState("All");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState<OrgInput>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Org | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = () => {
    setIsLoading(true);
    organizationApi
      .list()
      .then((res) => {
        if (!res.success) {
          setError(res.message || "Could not load organizations.");
          return;
        }
        setError(null);
        setOrganizations(res.organizations);
      })
      .catch(() => setError("Could not reach the server. Is xyra-core running?"))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return organizations.filter((org) => {
      if (q && ![org.orgCode, org.name, org.industry].join(" ").toLowerCase().includes(q)) return false;
      if (statusFilter !== "All" && org.status !== statusFilter) return false;
      if (regionFilter !== "All" && org.region !== regionFilter) return false;
      return true;
    });
  }, [organizations, query, statusFilter, regionFilter]);

  const set = (key: keyof OrgInput) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const openAdd = () => {
    setForm(DEFAULT_FORM);
    setIsAddOpen(true);
  };

  const onSubmitAdd = async () => {
    if (!form.orgCode.trim() || !form.name.trim() || !form.country.trim() || !form.primaryContact.trim() || !form.email.includes("@")) {
      notify("error", "Please fill in all mandatory fields correctly before saving.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await organizationApi.create(form);
      if (!res.success) {
        notify("error", res.message || "Could not create organization.");
        return;
      }
      setIsAddOpen(false);
      notify("success", `Organization '${form.name}' created successfully!`);
      load();
    } catch {
      notify("error", "Could not reach the server. Is xyra-core running?");
    } finally {
      setIsSaving(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      const res = await organizationApi.delete(pendingDelete.id);
      if (!res.success) {
        notify("error", res.message || "Could not delete organization.");
        return;
      }
      notify("success", `Organization '${pendingDelete.orgCode}' deleted.`);
      setPendingDelete(null);
      load();
    } catch {
      notify("error", "Could not reach the server. Is xyra-core running?");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title="Organization | Xyra" description="Organization management" />
      <PageHeader
        crumbs={["Organization"]}
        title="Organization Management"
        description="Manage organizations, company access and organization-specific configurations."
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <TableCard
        title="Managed Companies & Client Entities"
        count={filtered.length}
        actions={
          <>
            <SearchInput placeholder="Search Organization / Company ID..." value={query} onChange={setQuery} />
            <SelectField
              className="w-44"
              value={statusFilter}
              onChange={setStatusFilter}
              options={opts(["All", "Active", "Pending Setup", "Under Audit Review", "Inactive"])}
            />
            <SelectField
              className="w-44"
              value={regionFilter}
              onChange={setRegionFilter}
              options={opts(["All", ...REGION_OPTIONS.map((r) => r.value)])}
            />
            <Button size="sm" startIcon={<Plus className="size-4" />} onClick={openAdd}>
              Add Organization
            </Button>
          </>
        }
      >
        {isLoading ? (
          <Loading label="Loading organizations…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={SearchLg}
            title={query ? "No matching organizations" : "No organizations yet"}
            description={query ? "Try a different search term." : "Click Add Organization to register one."}
          />
        ) : (
          <Table>
            <TableHeader className={THEAD}>
              <TableRow>
                <TableCell isHeader className={TH}>Organization ID</TableCell>
                <TableCell isHeader className={TH}>Company Name</TableCell>
                <TableCell isHeader className={TH}>Industry</TableCell>
                <TableCell isHeader className={TH}>Region</TableCell>
                <TableCell isHeader className={TH}>System</TableCell>
                <TableCell isHeader className={TH}>Status</TableCell>
                <TableCell isHeader className={TH}>Created Date</TableCell>
                <TableCell isHeader className={TH}> </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className={TBODY}>
              {filtered.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className={TD}>
                    <div className="font-medium text-gray-800 dark:text-white/90">{org.orgCode}</div>
                    <div className="text-theme-xs">{org.country}</div>
                  </TableCell>
                  <TableCell className={TD}>
                    <div className="font-medium text-gray-800 dark:text-white/90">{org.name}</div>
                    <div className="text-theme-xs">{org.primaryContact}</div>
                  </TableCell>
                  <TableCell className={TD}>{org.industry}</TableCell>
                  <TableCell className={TD}>{org.region}</TableCell>
                  <TableCell className={TD}>
                    <XBadge color="brand">
                      {org.systemCount} {org.systemCount === 1 ? "System" : "Systems"}
                    </XBadge>
                  </TableCell>
                  <TableCell className={TD}>
                    <XBadge color={STATUS_BADGE_COLOR[org.status] ?? "success"}>{org.status}</XBadge>
                  </TableCell>
                  <TableCell className={`${TD} whitespace-nowrap`}>
                    {org.createdAt ? new Date(org.createdAt).toISOString().split("T")[0] : ""}
                  </TableCell>
                  <TableCell className={TD}>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" className="px-3! py-2!" onClick={() => navigate(`/organization/${org.id}`)}>
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="px-3! py-2! text-error-600! ring-error-300! dark:ring-error-500/40!"
                        onClick={() => setPendingDelete(org)}
                      >
                        Delete
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
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        size="lg"
        title="Create Organization"
        description="Register a new enterprise customer or company unit. Detailed SAP configurations and policies can be assigned inside Organization Details."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={isSaving} onClick={onSubmitAdd}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Organization ID" required placeholder="e.g. ORG-TATA-01, ORG-ACCN-02" value={form.orgCode} onChange={set("orgCode")} />
          <TextField label="Company Name" required placeholder="e.g. Tata Sons & Group" value={form.name} onChange={set("name")} />
          <SelectField label="Industry" required value={form.industry} onChange={set("industry")} options={opts(INDUSTRY_OPTIONS)} />
          <SelectField label="Region" required value={form.region} onChange={set("region")} options={REGION_OPTIONS} />
          <TextField label="Country" required placeholder="e.g. India, United States, Germany" value={form.country} onChange={set("country")} />
          <TextField label="Primary Contact" required placeholder="e.g. Ratan Sharma (VP GRC)" value={form.primaryContact} onChange={set("primaryContact")} />
          <TextField label="Email" required type="email" placeholder="e.g. grc@tata.com" value={form.email} onChange={set("email")} />
          <TextField label="Phone" placeholder="e.g. +91 22 6665 8282" value={form.phone} onChange={set("phone")} />
          <SelectField label="Organization Status" required value={form.status} onChange={set("status")} options={opts(STATUS_OPTIONS)} />
        </div>
      </Dialog>

      <Dialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        size="sm"
        title="Delete Organization"
        description={
          <>
            Are you sure you want to delete Organization{" "}
            <span className="font-semibold text-gray-800 dark:text-white/90">{pendingDelete?.orgCode}</span> ({pendingDelete?.name})? This
            permanently deletes its {pendingDelete?.systemCount} {pendingDelete?.systemCount === 1 ? "system" : "systems"} and everything
            tied to them — control runs, alerts, reviews and history. This cannot be undone.
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
