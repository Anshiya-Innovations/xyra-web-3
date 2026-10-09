import PageMeta from "@/components/common/PageMeta";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Tabs from "@/components/ui/tabs/Tabs";
import { notify } from "@/components/ui/toast/Toast";
import {
  type BadgeColors,
  Card,
  DetailItem,
  Dialog,
  ErrorBanner,
  IconButton,
  InfoBanner,
  Loading,
  opts,
  PageHeader,
  SelectField,
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
  type JiraSettings,
  type OrgInput,
  type Organization,
  type SlaSettings,
  type SystemEntry,
  jiraApi,
  organizationApi,
  systemConfigApi,
} from "@/lib/api-client";
import { ArrowLeft, Edit01, Plus, RefreshCw01, Trash01 } from "@untitledui/icons";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

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

const REGION_OPTIONS = ["Asia Pacific", "North America", "Europe", "Latin America", "Middle East & Africa"];
const STATUS_OPTIONS = ["Active", "Pending Setup", "Under Audit Review", "Inactive"];
const STATUS_BADGE_COLOR: Record<string, BadgeColors> = { "Pending Setup": "warning", "Under Audit Review": "brand", Inactive: "error" };
const CONNECTION_BADGE_COLOR: Record<string, BadgeColors> = { ONLINE: "success", OFFLINE: "error" };

// ponytail: Parameters tab has no backend (ported 1:1 from xyra-web's
// OrganizationDetails.controller.js, which seeds this same mock array and
// keeps add/remove in-memory only). Intentional demo content - add a real
// ParametersService if this is ever meant to persist.
type ParamType = "SET/GET Parameter" | "User Default Value";
type ParamRow = { id: string; paramType: ParamType; paramIdName: string; value: string; status: string };

const SEED_PARAMETERS: Omit<ParamRow, "id">[] = [
  { paramType: "SET/GET Parameter", paramIdName: "BUK - Company Code", value: "1000", status: "Enforced" },
  { paramType: "SET/GET Parameter", paramIdName: "WRK - Plant", value: "1010", status: "Active" },
  { paramType: "SET/GET Parameter", paramIdName: "VKO - Sales Organization", value: "1000", status: "Active" },
  { paramType: "SET/GET Parameter", paramIdName: "VTEG - Distribution Channel", value: "10", status: "Active" },
  { paramType: "SET/GET Parameter", paramIdName: "SPA - Memory ID", value: "MEM_TATA_PRD", status: "Enforced" },
  { paramType: "SET/GET Parameter", paramIdName: "KOK - Cost Center", value: "CC_2000", status: "Active" },
  { paramType: "SET/GET Parameter", paramIdName: "EKO - Purchasing Organization", value: "PO_1000", status: "Active" },
  { paramType: "User Default Value", paramIdName: "Decimal Notation", value: "1,234,567.89", status: "Enforced" },
  { paramType: "User Default Value", paramIdName: "Date Format", value: "DD.MM.YYYY", status: "Enforced" },
  { paramType: "User Default Value", paramIdName: "Time Zone", value: "IST (UTC+5:30)", status: "Active" },
  { paramType: "User Default Value", paramIdName: "Logon Language", value: "EN", status: "Active" },
  { paramType: "User Default Value", paramIdName: "Spool Output (DEST)", value: "LOCL", status: "Active" },
  { paramType: "User Default Value", paramIdName: "Output Device (PRINTER)", value: "PRN01_MUMBAI", status: "Pending Verification" },
];

const SET_GET_PARAM_IDS = [
  "BUK - Company Code",
  "WRK - Plant",
  "VKO - Sales Organization",
  "VTEG - Distribution Channel",
  "SPA - Memory ID",
  "KOK - Cost Center",
  "EKO - Purchasing Organization",
  "Custom",
];
const USER_DEFAULT_PARAM_IDS = [
  "Decimal Notation",
  "Date Format",
  "Time Zone",
  "Logon Language",
  "Spool Output (DEST)",
  "Output Device (PRINTER)",
  "Custom",
];
const PARAM_STATUS_OPTIONS = ["Active", "Enforced", "Pending Verification"];

const DEFAULT_JIRA: JiraSettings = {
  enabled: false,
  siteUrl: "",
  email: "",
  projectKey: "",
  issueType: "Task",
  hasToken: false,
  statusCreated: "",
  statusInProgress: "",
  statusResolved: "",
};
const DEFAULT_OPTION = { value: "", label: "-- Use Jira's default category --" };

type TabId = "details" | "config" | "parameters" | "policies" | "ticketing";

function toOrgForm(org: Organization): Omit<OrgInput, "orgCode"> {
  return {
    name: org.name,
    industry: org.industry,
    region: org.region,
    country: org.country,
    primaryContact: org.primaryContact,
    email: org.email,
    phone: org.phone,
    status: org.status,
  };
}

function slaSummaryText(s: SlaSettings): string {
  return `Reviewer 1: ${s.reviewer1Days} business days  ·  Reviewer 2: ${s.reviewer2Days} business days  ·  Escalation delay: ${s.escalationDelayDays} business days past Reviewer 2 SLA`;
}

export default function OrganizationDetails() {
  const navigate = useNavigate();
  const { orgId } = useParams();

  const [activeTab, setActiveTab] = useState<TabId>("details");
  const [org, setOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [systems, setSystems] = useState<SystemEntry[]>([]);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Omit<OrgInput, "orgCode">>({
    name: "",
    industry: INDUSTRY_OPTIONS[0],
    region: REGION_OPTIONS[0],
    country: "",
    primaryContact: "",
    email: "",
    phone: "",
    status: "Active",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [parameters, setParameters] = useState<ParamRow[]>([]);
  const [paramTypeFilter, setParamTypeFilter] = useState("All");
  const [isAddParamOpen, setIsAddParamOpen] = useState(false);
  const [newParamType, setNewParamType] = useState<ParamType>("SET/GET Parameter");
  const [newParamIdName, setNewParamIdName] = useState(SET_GET_PARAM_IDS[0]);
  const [newParamValue, setNewParamValue] = useState("");
  const [newParamStatus, setNewParamStatus] = useState("Active");

  const [slaSettings, setSlaSettings] = useState<SlaSettings | null>(null);
  const [isSlaOpen, setIsSlaOpen] = useState(false);
  const [slaForm, setSlaForm] = useState<SlaSettings>({ reviewer1Days: 3, reviewer2Days: 3, escalationDelayDays: 2 });
  const [isSavingSla, setIsSavingSla] = useState(false);

  const [jira, setJira] = useState<JiraSettings>(DEFAULT_JIRA);
  const [jiraApiToken, setJiraApiToken] = useState("");
  const [jiraStatusOptions, setJiraStatusOptions] = useState([DEFAULT_OPTION]);
  const [isSavingJira, setIsSavingJira] = useState(false);
  const [isFetchingStatuses, setIsFetchingStatuses] = useState(false);

  // Keeps the blank "use default category" option plus every distinct status
  // name seen so far (saved mapping + last live fetch) - switching back to an
  // already-mapped value never goes blank.
  const mergeJiraStatusOptions = (names: string[]) => {
    setJiraStatusOptions((existing) => {
      const seen = new Set<string>();
      const merged = [DEFAULT_OPTION];
      [...existing, ...names.map((n) => ({ value: n, label: n }))].forEach((o) => {
        if (o.value && !seen.has(o.value)) {
          seen.add(o.value);
          merged.push(o);
        }
      });
      return merged;
    });
  };

  const load = () => {
    if (!orgId) return;
    setIsLoading(true);
    organizationApi
      .get(orgId)
      .then((res) => {
        if (!res.success || !res.organization) {
          setError(res.message || "Could not load organization.");
          return;
        }
        setError(null);
        setOrg(res.organization);
        setParameters(SEED_PARAMETERS.map((p, i) => ({ ...p, id: `seed-${i}` })));
      })
      .catch(() => setError("Could not reach the server. Is xyra-core running?"))
      .finally(() => setIsLoading(false));

    systemConfigApi
      .list()
      .then((res) => res.success && setSystems(res.systems.filter((s) => s.organizationId === orgId)))
      .catch(() => {});

    systemConfigApi
      .getSlaSettings()
      .then((res) => res.success && setSlaSettings(res.settings))
      .catch(() => {});

    jiraApi
      .getSettings(orgId)
      .then((res) => {
        if (!res.success) return;
        setJira(res.settings);
        mergeJiraStatusOptions(
          [res.settings.statusCreated, res.settings.statusInProgress, res.settings.statusResolved].filter(Boolean),
        );
      })
      .catch(() => {});
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [orgId]);

  const filteredParameters = useMemo(
    () => (paramTypeFilter === "All" ? parameters : parameters.filter((p) => p.paramType === paramTypeFilter)),
    [parameters, paramTypeFilter],
  );

  const openEdit = () => {
    if (!org) return;
    setEditForm(toOrgForm(org));
    setIsEditOpen(true);
  };

  const onSubmitEdit = async () => {
    if (!org) return;
    if (!editForm.name.trim() || !editForm.country.trim() || !editForm.primaryContact.trim() || !editForm.email.includes("@")) {
      notify("error", "Please fill in all required fields before saving.");
      return;
    }
    setIsSavingEdit(true);
    try {
      const res = await organizationApi.update(org.id, editForm);
      if (!res.success) {
        notify("error", res.message || "Could not update organization.");
        return;
      }
      setOrg({ ...org, ...editForm });
      setIsEditOpen(false);
      notify("success", "Company Executive Summary updated successfully!");
    } catch {
      notify("error", "Could not reach the server. Is xyra-core running?");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openAddParam = () => {
    setNewParamType("SET/GET Parameter");
    setNewParamIdName(SET_GET_PARAM_IDS[0]);
    setNewParamValue("");
    setNewParamStatus("Active");
    setIsAddParamOpen(true);
  };

  const onSubmitAddParam = () => {
    if (!newParamValue.trim()) {
      notify("error", "Please enter a configured value for the parameter.");
      return;
    }
    setParameters((prev) => [
      { id: crypto.randomUUID(), paramType: newParamType, paramIdName: newParamIdName, value: newParamValue.trim(), status: newParamStatus },
      ...prev,
    ]);
    setIsAddParamOpen(false);
    notify("success", `Parameter '${newParamIdName}' added successfully!`);
  };

  const onRemoveParameter = (id: string) => {
    setParameters((prev) => prev.filter((p) => p.id !== id));
    notify("success", "Parameter removed.");
  };

  const openSla = () => {
    if (slaSettings) setSlaForm(slaSettings);
    setIsSlaOpen(true);
  };

  const onSaveSla = async () => {
    setIsSavingSla(true);
    try {
      const res = await systemConfigApi.updateSlaSettings(slaForm);
      if (!res.success) {
        notify("error", res.message || "Could not update SLA settings.");
        return;
      }
      setSlaSettings(slaForm);
      setIsSlaOpen(false);
      notify("success", "SLA settings updated.");
    } catch {
      notify("error", "Could not reach the server. Is xyra-core running?");
    } finally {
      setIsSavingSla(false);
    }
  };

  const onFetchJiraStatuses = async () => {
    if (!orgId) return;
    if (!jira.siteUrl.trim() || !jira.email.trim() || !jira.projectKey.trim()) {
      notify("error", "Fill in Site URL, Email, and Project Key first.");
      return;
    }
    setIsFetchingStatuses(true);
    try {
      const res = await jiraApi.getStatusOptions({
        organizationId: orgId,
        siteUrl: jira.siteUrl.trim(),
        email: jira.email.trim(),
        apiToken: jiraApiToken,
        projectKey: jira.projectKey.trim(),
      });
      if (!res.success) {
        notify("error", res.message || "Could not fetch statuses from Jira.");
        return;
      }
      mergeJiraStatusOptions(res.statuses);
      notify("success", `${res.statuses.length} status(es) loaded from Jira.`);
    } catch {
      notify("error", "Could not reach the server. Is xyra-core running?");
    } finally {
      setIsFetchingStatuses(false);
    }
  };

  const onSaveJira = async () => {
    if (!orgId) return;
    if (jira.enabled && (!jira.siteUrl.trim() || !jira.email.trim() || !jira.projectKey.trim())) {
      notify("error", "Site URL, Email, and Project Key are required to enable Jira ticket creation.");
      return;
    }
    setIsSavingJira(true);
    try {
      const res = await jiraApi.updateSettings(orgId, { ...jira, apiToken: jiraApiToken });
      if (!res.success) {
        notify("error", res.message || "Could not update Jira settings.");
        return;
      }
      setJiraApiToken("");
      notify("success", "Jira settings updated.");
      jiraApi.getSettings(orgId).then((res) => res.success && setJira(res.settings));
    } catch {
      notify("error", "Could not reach the server. Is xyra-core running?");
    } finally {
      setIsSavingJira(false);
    }
  };

  if (isLoading) return <Loading label="Loading organization…" />;

  if (!org) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorBanner>{error || "Organization not found."}</ErrorBanner>
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          startIcon={<ArrowLeft className="size-4" />}
          onClick={() => navigate("/organization")}
        >
          Back to Organizations
        </Button>
      </div>
    );
  }

  const setJ = (key: keyof JiraSettings) => (v: string) => setJira((j) => ({ ...j, [key]: v }));

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title={`${org.name} | Xyra`} description="Organization details" />
      <PageHeader
        crumbs={["Organization", org.name]}
        onBack={() => navigate("/organization")}
        title={`${org.name} (${org.orgCode})`}
        description="Enterprise Governance & Configuration Sub-Page"
        actions={<XBadge color={STATUS_BADGE_COLOR[org.status] ?? "success"}>{org.status}</XBadge>}
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div>
        <Tabs<TabId>
          selected={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: "details", label: "Company Details" },
            { id: "config", label: "Configurations" },
            { id: "parameters", label: "Parameters" },
            { id: "policies", label: "Policies" },
            { id: "ticketing", label: "Ticketing Integration" },
          ]}
        />

        <div className="pt-6">
          {activeTab === "details" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card
                title="Organization Profile"
                actions={
                  <Button variant="outline" size="sm" startIcon={<Edit01 className="size-4" />} onClick={openEdit}>
                    Edit
                  </Button>
                }
              >
                <div className="flex flex-col gap-4">
                  <DetailItem label="Company Name">{org.name}</DetailItem>
                  <DetailItem label="Organization ID">{org.orgCode}</DetailItem>
                  <DetailItem label="Industry">{org.industry}</DetailItem>
                  <DetailItem label="Region & Country">{`${org.region} (${org.country})`}</DetailItem>
                </div>
              </Card>
              <Card title="Contact & Status">
                <div className="flex flex-col gap-4">
                  <DetailItem label="Primary Contact">{org.primaryContact}</DetailItem>
                  <DetailItem label="Email Address">{org.email}</DetailItem>
                  <DetailItem label="Phone Number">{org.phone}</DetailItem>
                  <DetailItem label="Status">
                    <XBadge color={STATUS_BADGE_COLOR[org.status] ?? "success"}>{org.status}</XBadge>
                  </DetailItem>
                </div>
              </Card>
            </div>
          )}

          {activeTab === "config" && (
            <Card
              title="SAP Systems under this Organization"
              actions={<XBadge color="gray">{systems.length} System(s)</XBadge>}
              bodyClassName="p-0 sm:p-0"
            >
              {systems.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No Systems are assigned to this Organization yet - add one from System Configuration.
                </p>
              ) : (
                <div className="max-w-full overflow-x-auto">
                  <Table>
                    <TableHeader className={THEAD}>
                      <TableRow>
                        {["System ID", "Client", "Type", "Host Name", "Platform", "Region", "Sector", "Connection"].map((h) => (
                          <TableCell key={h} isHeader className={TH}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody className={TBODY}>
                      {systems.map((sys) => (
                        <TableRow key={sys.id}>
                          <TableCell className={TD_STRONG}>{sys.sysId}</TableCell>
                          <TableCell className={TD}>{sys.client}</TableCell>
                          <TableCell className={TD}>{sys.sysType}</TableCell>
                          <TableCell className={TD}>{sys.hostName}</TableCell>
                          <TableCell className={TD}>{sys.platform}</TableCell>
                          <TableCell className={TD}>{sys.region}</TableCell>
                          <TableCell className={TD}>{sys.sector}</TableCell>
                          <TableCell className={TD}>
                            <XBadge color={CONNECTION_BADGE_COLOR[sys.lastConnectionStatus] ?? "gray"}>
                              {sys.lastConnectionStatus || "UNKNOWN"}
                            </XBadge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          )}

          {activeTab === "parameters" && (
            <Card
              title="Organization-Specific SAP Parameters"
              bodyClassName="p-0 sm:p-0"
              actions={
                <>
                  <SelectField
                    className="w-52"
                    value={paramTypeFilter}
                    onChange={setParamTypeFilter}
                    options={[
                      { value: "All", label: "All Parameter Types" },
                      { value: "SET/GET Parameter", label: "SET/GET Parameter" },
                      { value: "User Default Value", label: "User Default Value" },
                    ]}
                  />
                  <Button size="sm" startIcon={<Plus className="size-4" />} onClick={openAddParam}>
                    Add Parameter
                  </Button>
                </>
              }
            >
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader className={THEAD}>
                    <TableRow>
                      <TableCell isHeader className={TH}>Parameter Type</TableCell>
                      <TableCell isHeader className={TH}>Parameter ID / Name</TableCell>
                      <TableCell isHeader className={TH}>Configured Value</TableCell>
                      <TableCell isHeader className={TH}>Status</TableCell>
                      <TableCell isHeader className={TH}> </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className={TBODY}>
                    {filteredParameters.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className={TD}>
                          <XBadge color="brand">{p.paramType}</XBadge>
                        </TableCell>
                        <TableCell className={TD_STRONG}>{p.paramIdName}</TableCell>
                        <TableCell className={TD}>{p.value}</TableCell>
                        <TableCell className={TD}>
                          <XBadge color={p.status === "Pending Verification" ? "warning" : "success"}>{p.status}</XBadge>
                        </TableCell>
                        <TableCell className={TD}>
                          <div className="flex justify-end">
                            <IconButton icon={Trash01} title="Remove Parameter" danger onClick={() => onRemoveParameter(p.id)} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {activeTab === "policies" && (
            <Card
              title="Review SLA Policy"
              actions={
                <Button size="sm" startIcon={<Edit01 className="size-4" />} onClick={openSla}>
                  Edit SLA Settings
                </Button>
              }
            >
              <InfoBanner>
                The one governance policy this organization currently enforces: business-day deadlines for the Reviewer 1 → Reviewer 2
                deviation review chain, and when an overdue item gets flagged for the Escalation Manager.
              </InfoBanner>
              <div className="mt-4">
                <DetailItem label="Reviewer Escalation SLA Window">{slaSettings ? slaSummaryText(slaSettings) : "Loading…"}</DetailItem>
              </div>
            </Card>
          )}

          {activeTab === "ticketing" && (
            <Card
              title="Ticketing Integration"
              actions={
                <Button size="sm" loading={isSavingJira} onClick={onSaveJira}>
                  Save
                </Button>
              }
            >
              <InfoBanner>
                When enabled, rejecting a deviation for a System under this Organization creates a real Jira issue instead of a local
                placeholder ticket number. The API token is never shown back once saved.
              </InfoBanner>

              <div className="my-5">
                <Toggle
                  checked={jira.enabled}
                  onChange={(enabled) => setJira((j) => ({ ...j, enabled }))}
                  label="Enable Jira ticket creation for this Organization"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField label="Jira Site URL" required placeholder="https://yourcompany.atlassian.net" value={jira.siteUrl} onChange={setJ("siteUrl")} />
                <TextField label="Project (Space) Key" required placeholder="e.g. XS" value={jira.projectKey} onChange={setJ("projectKey")} />
                <TextField label="Atlassian Account Email" required type="email" placeholder="you@company.com" value={jira.email} onChange={setJ("email")} />
                <TextField label="Issue Type" placeholder="Task" value={jira.issueType} onChange={setJ("issueType")} />
                <TextField
                  label="API Token"
                  type="password"
                  placeholder={jira.hasToken ? "Token on file - leave blank to keep it" : "Paste your Atlassian API token"}
                  value={jiraApiToken}
                  onChange={setJiraApiToken}
                />
              </div>

              <h4 className="mt-8 mb-3 text-base font-semibold text-gray-800 dark:text-white/90">Status Mapping</h4>
              <InfoBanner>
                Every Jira board names its own statuses. Fetch this board's real statuses, then map which one means each stage below -
                unmapped stages fall back to Jira's own To Do / In Progress / Done categories.
              </InfoBanner>
              <Button
                variant="outline"
                size="sm"
                className="my-4"
                startIcon={<RefreshCw01 className="size-4" />}
                loading={isFetchingStatuses}
                onClick={onFetchJiraStatuses}
              >
                Fetch Live Statuses from Jira
              </Button>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <SelectField label="Ticket Created" value={jira.statusCreated} onChange={setJ("statusCreated")} options={jiraStatusOptions} />
                <SelectField label="In Progress" value={jira.statusInProgress} onChange={setJ("statusInProgress")} options={jiraStatusOptions} />
                <SelectField label="Resolved" value={jira.statusResolved} onChange={setJ("statusResolved")} options={jiraStatusOptions} />
              </div>
            </Card>
          )}
        </div>
      </div>

      <Dialog
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        size="lg"
        title="Edit Company Executive Summary"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={isSavingEdit} onClick={onSubmitEdit}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Organization ID" readOnly value={org.orgCode} />
          <TextField label="Company Name" required value={editForm.name} onChange={(v) => setEditForm((f) => ({ ...f, name: v }))} />
          <SelectField
            label="Industry"
            required
            value={editForm.industry}
            onChange={(v) => setEditForm((f) => ({ ...f, industry: v }))}
            options={opts(INDUSTRY_OPTIONS)}
          />
          <SelectField
            label="Region"
            required
            value={editForm.region}
            onChange={(v) => setEditForm((f) => ({ ...f, region: v }))}
            options={opts(REGION_OPTIONS)}
          />
          <TextField label="Country" required value={editForm.country} onChange={(v) => setEditForm((f) => ({ ...f, country: v }))} />
          <TextField
            label="Primary Contact"
            required
            value={editForm.primaryContact}
            onChange={(v) => setEditForm((f) => ({ ...f, primaryContact: v }))}
          />
          <TextField
            label="Email Address"
            required
            type="email"
            value={editForm.email}
            onChange={(v) => setEditForm((f) => ({ ...f, email: v }))}
          />
          <TextField label="Phone Number" value={editForm.phone} onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))} />
          <SelectField
            label="Status"
            required
            value={editForm.status}
            onChange={(v) => setEditForm((f) => ({ ...f, status: v }))}
            options={opts(STATUS_OPTIONS)}
          />
        </div>
      </Dialog>

      <Dialog
        open={isAddParamOpen}
        onClose={() => setIsAddParamOpen(false)}
        size="sm"
        title="Add Organization Parameter"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsAddParamOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" startIcon={<Plus className="size-4" />} onClick={onSubmitAddParam}>
              Add Parameter
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <SelectField
            label="Parameter Type"
            required
            value={newParamType}
            onChange={(v) => {
              const type = v as ParamType;
              setNewParamType(type);
              setNewParamIdName(type === "SET/GET Parameter" ? SET_GET_PARAM_IDS[0] : USER_DEFAULT_PARAM_IDS[0]);
            }}
            options={opts(["SET/GET Parameter", "User Default Value"])}
          />
          <SelectField
            label="Parameter ID / Name"
            required
            value={newParamIdName}
            onChange={setNewParamIdName}
            options={opts(newParamType === "SET/GET Parameter" ? SET_GET_PARAM_IDS : USER_DEFAULT_PARAM_IDS)}
          />
          <TextField
            label="Configured Value"
            required
            placeholder="e.g. 1000, DD.MM.YYYY, IST"
            value={newParamValue}
            onChange={setNewParamValue}
          />
          <SelectField label="Status" required value={newParamStatus} onChange={setNewParamStatus} options={opts(PARAM_STATUS_OPTIONS)} />
        </div>
      </Dialog>

      <Dialog
        open={isSlaOpen}
        onClose={() => setIsSlaOpen(false)}
        size="sm"
        title="Reviewer Escalation SLA Settings"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsSlaOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={isSavingSla} onClick={onSaveSla}>
              Save Changes
            </Button>
          </>
        }
      >
        <InfoBanner>
          Business-day deadlines for the review chain. The Reviewer 1 clock starts when a deviation is detected; the Reviewer 2 clock
          starts once Reviewer 1 approves. Escalation Manager has no decision of their own - they're flagged once a Level 2 item is overdue
          by more than the escalation delay below.
        </InfoBanner>
        <div className="mt-4 flex flex-col gap-4">
          <TextField
            label="Reviewer 1 SLA (business days)"
            required
            type="number"
            value={String(slaForm.reviewer1Days)}
            onChange={(v) => setSlaForm((f) => ({ ...f, reviewer1Days: Number(v) || 0 }))}
          />
          <TextField
            label="Reviewer 2 SLA (business days)"
            required
            type="number"
            value={String(slaForm.reviewer2Days)}
            onChange={(v) => setSlaForm((f) => ({ ...f, reviewer2Days: Number(v) || 0 }))}
          />
          <TextField
            label="Escalation delay past Reviewer 2 SLA (business days)"
            required
            type="number"
            value={String(slaForm.escalationDelayDays)}
            onChange={(v) => setSlaForm((f) => ({ ...f, escalationDelayDays: Number(v) || 0 }))}
          />
        </div>
      </Dialog>
    </div>
  );
}
