import PageMeta from "@/components/common/PageMeta";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import {
  Card,
  Dialog,
  ErrorBanner,
  IconButton,
  Loading,
  opts,
  PageHeader,
  SelectField,
  TBODY,
  TD,
  TextAreaField,
  TextField,
  TH,
  THEAD,
} from "@/components/xyra/kit";
import { controlApi } from "@/lib/api-client";
import { calculateTotalRun, FREQ_BE_TO_UI, FREQ_UI_TO_BE } from "@/lib/control-frequency";
import {
  emptyDraft,
  KNOWN_EXPECTED,
  OPERATORS,
  PARAMETER_TYPES,
  parameterLabel,
  parameterOptionsFor,
  resolveRule,
  SAP_OBJECTS,
  type UiRule,
  unresolveRule,
  validateRule,
} from "@/lib/rule-presets";
import { Plus, Trash01 } from "@untitledui/icons";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

const FREQUENCIES = ["Monthly (Last day of month)", "Weekly (Every Monday)", "Daily", "Realtime", "Cron Expression"];

export default function ControlEditor() {
  const navigate = useNavigate();
  const { controlId } = useParams();
  const isEdit = !!controlId;

  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<{ category: string; enabled: boolean } | null>(null);

  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [controlType, setControlType] = useState("SECURITY");
  const [frequency, setFrequency] = useState("Daily");
  const [cron, setCron] = useState("");
  const [rules, setRules] = useState<UiRule[]>([]);

  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [draft, setDraft] = useState<UiRule>(emptyDraft());

  useEffect(() => {
    if (!controlId) return;
    controlApi
      .get(controlId)
      .then((res) => {
        setIsLoading(false);
        if (!res.success || !res.control) {
          setError(res.message || "Could not load this control.");
          return;
        }
        const c = res.control;
        setCode(c.code);
        setDescription(c.description);
        setSeverity(c.severity);
        setControlType(c.controlType);
        setFrequency(FREQ_BE_TO_UI[c.frequency] || "Daily");
        setCron(c.cronExpression || "");
        setRules(c.rules.map(unresolveRule));
        setExisting({ category: c.category, enabled: c.enabled });
      })
      .catch(() => {
        setIsLoading(false);
        setError("Could not reach the server. Is xyra-core running?");
      });
  }, [controlId]);

  const openAddRule = () => {
    setDraft(emptyDraft());
    setIsRuleDialogOpen(true);
  };

  const confirmAddRule = () => {
    const err = validateRule(draft, `Rule ${rules.length + 1}`);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setRules((prev) => [...prev, draft]);
    setIsRuleDialogOpen(false);
  };

  const removeRule = (key: string) => setRules((prev) => prev.filter((r) => r.key !== key));

  const onSave = async () => {
    setError(null);
    if (!code.trim() || !description.trim()) {
      setError("Control ID and Control Description are mandatory.");
      return;
    }
    if (frequency === "Cron Expression" && !cron.trim()) {
      setError("Please specify a Cron Expression.");
      return;
    }
    if (rules.length === 0) {
      setError("Add at least one Rule before saving.");
      return;
    }
    for (let i = 0; i < rules.length; i++) {
      const err = validateRule(rules[i], `Rule ${i + 1}`);
      if (err) {
        setError(err);
        return;
      }
    }

    setIsSaving(true);
    const resolvedRules = rules.map(resolveRule);
    try {
      if (isEdit && controlId) {
        const res = await controlApi.update(controlId, {
          description: description.trim(),
          category: existing?.category ?? null,
          controlType,
          severity,
          frequency: FREQ_UI_TO_BE[frequency] || "DAILY",
          cronExpression: cron.trim() || null,
          enabled: existing?.enabled ?? true,
          rules: resolvedRules,
        });
        if (!res.success) {
          setError(res.message || "Could not update control.");
          return;
        }
      } else {
        const res = await controlApi.create({
          code: code.trim(),
          description: description.trim(),
          category: null,
          controlType,
          severity,
          frequency: FREQ_UI_TO_BE[frequency] || "DAILY",
          cronExpression: cron.trim() || null,
          rules: resolvedRules,
        });
        if (!res.success) {
          setError(res.message || "Could not create control.");
          return;
        }
      }
      navigate("/controls");
    } catch {
      setError("Could not reach the server. Is xyra-core running?");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <Loading label="Loading control…" />;

  const parameterOptions = parameterOptionsFor(draft.parameterType);
  const isFailedLogins = draft.parameter === "Failed Logins";

  return (
    <div className="flex flex-col gap-6">
      <PageMeta title={`${isEdit ? "Edit" : "Create"} Control | Xyra`} description="Configure a security control" />
      <PageHeader
        crumbs={["Control Management", "Controls Config", isEdit ? `Edit ${code}` : "Create Control"]}
        onBack={() => navigate("/controls")}
        title={isEdit ? `Edit Security Control: ${code}` : "Create Security Control"}
        description="Configure the control's severity, schedule, and validation rules."
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Card title="Control Details">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField label="Control ID" required disabled={isEdit} placeholder="e.g. XYRA-08" value={code} onChange={setCode} />
          <SelectField label="Severity" required value={severity} onChange={setSeverity} options={opts(["LOW", "MEDIUM", "HIGH"])} />
          <SelectField
            label="Control Type"
            required
            value={controlType}
            onChange={setControlType}
            options={[
              { value: "SECURITY", label: "Security" },
              { value: "BASIS", label: "Basis" },
              { value: "GXP", label: "GxP" },
            ]}
          />
          <SelectField label="Frequency Run" required value={frequency} onChange={setFrequency} options={opts(FREQUENCIES)} />
          {frequency === "Cron Expression" && (
            <TextField
              label="Cron Expression"
              required
              placeholder="e.g. 0 0 1 * *"
              hint="'* * * * *' Realtime | '0 0 * * *' Daily | '0 0 * * 1' Weekly"
              value={cron}
              onChange={setCron}
            />
          )}
          <TextField label="Total Run (read-only)" readOnly value={calculateTotalRun(frequency, cron)} />
        </div>
        <TextAreaField
          className="mt-5"
          label="Control Description"
          required
          rows={3}
          placeholder="Enter detailed control description..."
          value={description}
          onChange={setDescription}
        />
      </Card>

      <Card
        title="Rule Configuration"
        bodyClassName="p-0 sm:p-0"
        actions={
          <Button size="sm" startIcon={<Plus className="size-4" />} onClick={openAddRule}>
            Add Rule
          </Button>
        }
      >
        {rules.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No rules added yet.</p>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className={THEAD}>
                <TableRow>
                  <TableCell isHeader className={TH}>SAP Object</TableCell>
                  <TableCell isHeader className={TH}>Parameter Type</TableCell>
                  <TableCell isHeader className={TH}>Parameter</TableCell>
                  <TableCell isHeader className={TH}>Validation</TableCell>
                  <TableCell isHeader className={TH}>Expected Value</TableCell>
                  <TableCell isHeader className={TH}> </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className={TBODY}>
                {rules.map((rule) => (
                  <TableRow key={rule.key}>
                    <TableCell className={TD}>{rule.sapObject}</TableCell>
                    <TableCell className={TD}>{rule.parameterType}</TableCell>
                    <TableCell className={TD}>{rule.parameter === "Custom" ? rule.customParameter : rule.parameter}</TableCell>
                    <TableCell className={TD}>{rule.operator}</TableCell>
                    <TableCell className={TD}>
                      {rule.expectedValue === "Custom" ? rule.customExpectedValue : rule.expectedValue}
                    </TableCell>
                    <TableCell className={TD}>
                      <IconButton icon={Trash01} title="Delete Rule" danger onClick={() => removeRule(rule.key)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/controls")}>
          Cancel
        </Button>
        <Button size="sm" loading={isSaving} onClick={onSave}>
          Save
        </Button>
      </div>

      <Dialog
        open={isRuleDialogOpen}
        onClose={() => setIsRuleDialogOpen(false)}
        size="lg"
        title="Add Rule"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsRuleDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" startIcon={<Plus className="size-4" />} onClick={confirmAddRule}>
              Add Rule
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <SelectField
              label="SAP Object"
              required
              placeholder="Select"
              value={draft.sapObject}
              onChange={(v) => setDraft({ ...draft, sapObject: v })}
              options={opts(SAP_OBJECTS)}
            />
            <SelectField
              label="Parameter Type"
              required
              placeholder="Select"
              value={draft.parameterType}
              onChange={(v) => setDraft({ ...draft, parameterType: v, parameter: "", customParameter: "" })}
              options={opts(PARAMETER_TYPES)}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <SelectField
                label="Parameter"
                required
                placeholder="Select"
                disabled={!draft.parameterType}
                value={draft.parameter}
                onChange={(v) => setDraft({ ...draft, parameter: v })}
                options={opts([...parameterOptions, "Custom"], (v) => parameterLabel(draft.parameterType, v))}
              />
              {draft.parameter === "Custom" && (
                <TextField
                  placeholder="Enter parameter name..."
                  value={draft.customParameter}
                  onChange={(v) => setDraft({ ...draft, customParameter: v })}
                />
              )}
            </div>

            <SelectField
              label="Validation"
              required
              placeholder="Select"
              value={draft.operator}
              onChange={(v) => setDraft({ ...draft, operator: v })}
              options={opts(OPERATORS)}
            />

            <div className="flex flex-col gap-2">
              {isFailedLogins ? (
                <TextField
                  label="Expected Value"
                  required
                  type="number"
                  placeholder="e.g. 3"
                  value={draft.expectedValue}
                  onChange={(v) => setDraft({ ...draft, expectedValue: v })}
                />
              ) : (
                <>
                  <SelectField
                    label="Expected Value"
                    required
                    placeholder="Select"
                    value={draft.expectedValue}
                    onChange={(v) => setDraft({ ...draft, expectedValue: v })}
                    options={opts([...KNOWN_EXPECTED, "Custom"])}
                  />
                  {draft.expectedValue === "Custom" && (
                    <TextField
                      placeholder="Enter custom expected value..."
                      value={draft.customExpectedValue}
                      onChange={(v) => setDraft({ ...draft, customExpectedValue: v })}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
