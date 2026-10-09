import EmptyState from "@/components/common/EmptyState";
import PageMeta from "@/components/common/PageMeta";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import Tabs from "@/components/ui/tabs/Tabs";
import { notify } from "@/components/ui/toast/Toast";
import {
  Dialog,
  ErrorBanner,
  Loading,
  opts,
  PageHeader,
  SelectField,
  TableCard,
  TBODY,
  TD,
  TD_STRONG,
  TextField,
  TH,
  THEAD,
  XBadge,
} from "@/components/xyra/kit";
import { type AdminUser, type Organization, adminApi, organizationApi } from "@/lib/api-client";
import { Plus, Server05, Trash01 } from "@untitledui/icons";
import { useEffect, useState } from "react";

const PERSONA_TO_ROLE: Record<string, string> = {
  "Escalation Manager": "ESCALATION_MANAGER",
  "Reviewer 1": "REVIEWER",
  "Reviewer 2": "REVIEWER",
  Auditor: "AUDITOR",
};
const PERSONA_OPTIONS = Object.keys(PERSONA_TO_ROLE);

const ROLE_TO_PERSONA: Record<string, string> = {
  ADMIN: "Admin",
  ESCALATION_MANAGER: "Escalation Manager",
  REVIEWER: "Reviewer",
  AUDITOR: "Auditor",
};

// xyra-web never collects a password on this form - new accounts are
// provisioned with this fixed temp password and reset via "Reset Password"
// afterward. Ported as-is rather than inventing a password field.
const TEMP_PASSWORD = "TemporaryPassword123!";

const DEFAULT_CREATE_FORM = { name: "", email: "", organization: "", persona: "" };

export default function AccessManagement() {
  const [activeTab, setActiveTab] = useState<"users" | "ad">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [isCreating, setIsCreating] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<AdminUser | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const loadUsers = () => {
    setIsLoading(true);
    adminApi
      .listUsers()
      .then((res) => {
        setError(null);
        setUsers(res.value || []);
      })
      .catch(() => setError("Could not reach the server. Is xyra-core running?"))
      .finally(() => setIsLoading(false));
  };

  useEffect(loadUsers, []);
  useEffect(() => {
    organizationApi
      .list()
      .then((res) => setOrganizations(res.success ? res.organizations : []))
      .catch(() => setOrganizations([]));
  }, []);

  const set = (key: keyof typeof DEFAULT_CREATE_FORM) => (value: string) => setCreateForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setCreateForm(DEFAULT_CREATE_FORM);
    setIsCreateOpen(true);
  };

  const onSubmitCreate = async () => {
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.organization || !createForm.persona) {
      notify("error", "Please fill in Name, Email, Organization, and select a Persona.");
      return;
    }
    const roleCode = PERSONA_TO_ROLE[createForm.persona];
    setIsCreating(true);
    try {
      const res = await adminApi.createUser({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        password: TEMP_PASSWORD,
        roleCode,
        organization: createForm.organization,
      });
      if (!res.success) {
        notify("error", res.message || "Could not create user.");
        return;
      }
      setIsCreateOpen(false);
      notify("success", `User provisioned successfully: ${createForm.email} as ${createForm.persona}`);
      loadUsers();
    } catch {
      notify("error", "Could not reach the server. Is xyra-core running?");
    } finally {
      setIsCreating(false);
    }
  };

  const onConfirmRemove = async () => {
    if (!removeTarget) return;
    setIsRemoving(true);
    try {
      const res = await adminApi.removeUser(removeTarget.id);
      if (!res.success) {
        notify("error", res.message || "Could not remove user.");
        return;
      }
      notify("success", `User access removed for ${removeTarget.email}`);
      setRemoveTarget(null);
      loadUsers();
    } catch {
      notify("error", "Could not reach the server. Is xyra-core running?");
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title="Access Management | Xyra" description="User access provisioning & persona management" />
      <PageHeader crumbs={["Access Management"]} title="Access Management" description="User access provisioning & persona management." />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div>
        <Tabs
          selected={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: "users", label: "Users" },
            { id: "ad", label: "AD Management" },
          ]}
        />
        <div className="pt-6">
          {activeTab === "users" ? (
            <TableCard
              title="Provisioned Enterprise Users"
              count={users.length}
              actions={
                <Button size="sm" startIcon={<Plus className="size-4" />} onClick={openCreate}>
                  Create User
                </Button>
              }
            >
              {isLoading ? (
                <Loading label="Loading users…" />
              ) : (
                <Table>
                  <TableHeader className={THEAD}>
                    <TableRow>
                      {["Name", "Email ID", "Organization", "Persona / Role", "Status", "Created Date", ""].map((h) => (
                        <TableCell key={h} isHeader className={TH}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody className={TBODY}>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className={TD_STRONG}>{user.name}</TableCell>
                        <TableCell className={TD}>{user.email}</TableCell>
                        <TableCell className={TD}>
                          <XBadge color="gray">{user.organization}</XBadge>
                        </TableCell>
                        <TableCell className={TD}>
                          <XBadge color="brand">{ROLE_TO_PERSONA[user.role] || user.role}</XBadge>
                        </TableCell>
                        <TableCell className={TD}>
                          <XBadge color="success">{user.status}</XBadge>
                        </TableCell>
                        <TableCell className={`${TD} whitespace-nowrap`}>
                          {user.createdAt ? new Date(user.createdAt).toISOString().split("T")[0] : ""}
                        </TableCell>
                        <TableCell className={TD}>
                          <div className="flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="px-3! py-2! text-error-600! ring-error-300! dark:ring-error-500/40!"
                              startIcon={<Trash01 className="size-4" />}
                              onClick={() => setRemoveTarget(user)}
                            >
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TableCard>
          ) : (
            <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
              <EmptyState
                icon={Server05}
                title="AD Management"
                description="Active Directory sync and group mapping will live here. This section is coming soon."
              />
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create User / Provision Access"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={isCreating} onClick={onSubmitCreate}>
              Create User
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField label="User Name" required placeholder="e.g. Jane Doe" value={createForm.name} onChange={set("name")} />
          <TextField label="User Email" required type="email" placeholder="e.g. user@xyra.ai" value={createForm.email} onChange={set("email")} />
          <SelectField
            label="Organization / Company"
            required
            placeholder="Select an organization"
            value={createForm.organization}
            onChange={set("organization")}
            options={organizations.map((org) => ({ value: org.name, label: `${org.orgCode} - ${org.name}` }))}
          />
          <SelectField
            label="Persona / Role"
            required
            placeholder="Select a persona"
            value={createForm.persona}
            onChange={set("persona")}
            options={opts(PERSONA_OPTIONS)}
          />
        </div>
      </Dialog>

      <Dialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        size="sm"
        title="Remove User Access"
        description={
          <>
            Are you sure you want to remove user access for{" "}
            <span className="font-semibold text-gray-800 dark:text-white/90">{removeTarget?.email}</span>?
          </>
        }
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" loading={isRemoving} onClick={onConfirmRemove}>
              Remove
            </Button>
          </>
        }
      />
    </div>
  );
}
