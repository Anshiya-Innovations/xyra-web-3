import PageMeta from "@/components/common/PageMeta";
import Button from "@/components/ui/button/Button";
import { notify } from "@/components/ui/toast/Toast";
import { Card, ErrorBanner, Loading, PageHeader, TextField, XBadge } from "@/components/xyra/kit";
import { type ProfileEntry, profileApi } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { ArrowLeft, RefreshCw01, Save01 } from "@untitledui/icons";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

type FormState = { name: string; phone: string; department: string; organization: string };

function toForm(p: ProfileEntry): FormState {
  return { name: p.name || "", phone: p.phone || "", department: p.department || "", organization: p.organization || "" };
}

// Where "Back" lands when there's no in-app history (profile opened directly
// by URL or in a new tab) - each persona's own home page.
const HOME_BY_ROLE: Record<string, string> = {
  REVIEWER: "/reviewer-1",
  ESCALATION_MANAGER: "/escalation-manager",
  AUDITOR: "/auditor",
};

export default function Profile() {
  const session = getSession();
  const navigate = useNavigate();
  // react-router stores the in-app history index as `idx`; 0 means this was the first page loaded.
  const goBack = () =>
    window.history.state?.idx > 0 ? navigate(-1) : navigate(HOME_BY_ROLE[session?.role ?? ""] ?? "/dashboard");
  const [profile, setProfile] = useState<ProfileEntry | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", phone: "", department: "", organization: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const load = () => {
    setIsLoading(true);
    profileApi
      .get()
      .then((res) => {
        if (!res.success) {
          setError(res.message || "Could not load profile.");
          return;
        }
        setError(null);
        setProfile(res);
        setForm(toForm(res));
      })
      .catch(() => setError("Could not reach the server. Is xyra-core running?"))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const onReset = () => {
    if (profile) setForm(toForm(profile));
    notify("success", "Personal & account details reset to original values.");
  };

  const onSave = async () => {
    if (!form.name.trim()) {
      notify("error", "Full Name is required.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await profileApi.update(form);
      if (!res.success) {
        notify("error", res.message || "Could not save profile.");
        return;
      }
      notify("success", "Personal & account details saved successfully.");
      load();
    } catch {
      notify("error", "Could not reach the server. Is xyra-core running?");
    } finally {
      setIsSaving(false);
    }
  };

  const onSavePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      notify("error", "Please enter Current Password, New Password, and Confirm Password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      notify("error", "New Password and Confirm Password do not match.");
      return;
    }
    setIsChangingPassword(true);
    try {
      const res = await profileApi.changePassword(currentPassword, newPassword);
      if (!res.success) {
        notify("error", res.message || "Could not change password.");
        return;
      }
      notify("success", "Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      notify("error", "Could not reach the server. Is xyra-core running?");
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) return <Loading label="Loading profile…" />;

  if (!profile) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorBanner>{error || "Could not load your profile."}</ErrorBanner>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" startIcon={<ArrowLeft className="size-4" />} onClick={goBack}>
            Back
          </Button>
          <Button variant="outline" size="sm" startIcon={<RefreshCw01 className="size-4" />} onClick={load}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const initials = (profile.name || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title="Profile | Xyra" description="User profile and account settings" />
      <PageHeader
        crumbs={["Profile"]}
        onBack={goBack}
        title="User Profile & Account Settings"
        description="Manage your user details and security credentials."
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="flex items-center gap-5 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-800 dark:bg-white/3">
        <span className="flex size-20 items-center justify-center rounded-full bg-brand-50 text-2xl font-semibold text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
          {initials}
        </span>
        <div className="flex flex-col gap-2">
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">{profile.name}</h4>
          <div className="flex items-center gap-3">
            <XBadge color="brand">{profile.role}</XBadge>
            <span className="text-sm text-gray-500 dark:text-gray-400">User ID: {profile.id.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>
      </div>

      <Card title="Personal & Account Details">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField label="Full Name" required value={form.name} onChange={set("name")} />
          <TextField label="Email Address" value={profile.email} readOnly />
          <TextField label="Phone Number" type="tel" value={form.phone} onChange={set("phone")} />
          <TextField label="Role" value={profile.role} readOnly />
          <TextField label="Department" value={form.department} onChange={set("department")} />
          <TextField label="Enterprise Subdomain" value={window.location.hostname} readOnly />
          <TextField label="Organization" value={form.organization} onChange={set("organization")} />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onReset}>
            Reset
          </Button>
          <Button size="sm" startIcon={<Save01 className="size-4" />} loading={isSaving} onClick={onSave}>
            Save Profile Changes
          </Button>
        </div>
      </Card>

      <Card title="Change Password" description="Update the password used to sign in.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <TextField label="Current Password" required type="password" value={currentPassword} onChange={setCurrentPassword} />
          <TextField label="New Password" required type="password" value={newPassword} onChange={setNewPassword} />
          <TextField label="Confirm New Password" required type="password" value={confirmPassword} onChange={setConfirmPassword} />
        </div>
        <div className="mt-6 flex justify-end">
          <Button size="sm" startIcon={<Save01 className="size-4" />} loading={isChangingPassword} onClick={onSavePassword}>
            Update Password
          </Button>
        </div>
      </Card>
    </div>
  );
}
