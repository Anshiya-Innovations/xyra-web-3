import { AUTH_BASE_URL } from "@/lib/config";
import { getMockResponse, notifyBackendOffline } from "@/lib/mock-data";
import { clearSession, getSession } from "@/lib/session";

// One POST-and-parse-JSON helper, one call site per xyra-core action below,
// instead of every page repeating fetch()+headers+JSON.stringify+.json() by
// hand (what xyra-web's per-page controllers do). The session token is the
// only identity sent: xyra-core derives tenant, user and persona (and the
// audit "performed by") from it, so none of those are ever in a request body.
// CAP 400s on undeclared action params, so don't add them back here.
//
// A 401 means the session expired, was forged, or the workspace was
// suspended - drop it and go back to login.
//
// If xyra-core is unreachable (fetch rejects - not an HTTP error, a real
// network failure), fall back to dummy data for read actions that have a
// mock registered (mock-data.ts), matching xyra-web's offline behavior.
// Mutations have no mock registered, so they rethrow and still show a real
// "could not reach the server" error instead of faking a write that succeeded.
async function call<T>(service: string, action: string, body: Record<string, unknown> = {}): Promise<T> {
    const session = getSession();
    let res: Response;
    try {
        res = await fetch(`${AUTH_BASE_URL}/api/${service}/${action}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(session?.token && { Authorization: `Bearer ${session.token}` }) },
            body: JSON.stringify(body),
        });
    } catch (err) {
        const mock = getMockResponse(service, action, body, session);
        if (mock === undefined) throw err;
        notifyBackendOffline();
        return mock as T;
    }
    if (res.status === 401) {
        clearSession();
        window.location.assign(`${import.meta.env.BASE_URL}login`);
        throw new Error("Session expired - please sign in again.");
    }
    return (await res.json()) as T;
}

export type ControlRule = {
    id?: string;
    sortOrder?: number;
    sapObject: string;
    parameterType: string;
    parameter: string;
    operator: string;
    expectedValue: string;
};

export type Control = {
    id: string;
    code: string;
    description: string;
    category: string;
    controlType: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    frequency: string;
    cronExpression: string;
    enabled: boolean;
    systemIds: string[];
    lastRunAt: string | null;
    lastRunStatus: string;
    nextRunAt: string | null;
    rules: ControlRule[];
    createdAt: string;
    createdBy: string;
    modifiedAt: string;
    modifiedBy: string;
};

type ActionResult = { success: boolean; message: string };

export const controlApi = {
    list: () => call<ActionResult & { controls: Control[] }>("control", "listControls"),

    get: (id: string) => call<ActionResult & { control: Control | null }>("control", "getControl", { id }),

    create: (input: {
        code: string;
        description: string;
        category?: string | null;
        controlType: string;
        severity: string;
        frequency: string;
        cronExpression?: string | null;
        rules: ControlRule[];
    }) => call<ActionResult & { id: string }>("control", "createControl", input),

    update: (
        id: string,
        input: {
            description: string;
            category?: string | null;
            controlType: string;
            severity: string;
            frequency: string;
            cronExpression?: string | null;
            enabled: boolean;
            rules: ControlRule[];
        },
    ) => call<ActionResult>("control", "updateControl", { id, ...input }),

    delete: (id: string) => call<ActionResult>("control", "deleteControl", { id }),

    runNow: (id: string) => call<ActionResult & { deviationsFound: number; alertsCreated: number }>("control", "runControlNow", { id }),

    listControlHistory: (filters: ControlHistoryFilters) => call<ActionResult & { history: ControlHistoryEntry[] }>("control", "listControlHistory", filters),
};

export type ControlHistoryEntry = {
    controlId: string;
    controlDescription: string;
    systemId: string;
    client: string;
    region: string;
    platform: string;
    sector: string;
    sapObject: string;
    parameter: string;
    operator: string;
    actualValue: string;
    expectedValue: string;
    deviationFlag: boolean;
    message: string;
    capturedAt: string;
};

export type ControlHistoryFilters = {
    controlId: string;
    systemId?: string;
    client?: string;
    region?: string;
    platform?: string;
    sector?: string;
    startDate?: string;
    endDate?: string;
};

export type SystemControlConfig = {
    id: string;
    controlId: string;
    controlCode: string;
    controlDescription: string;
    controlSeverity: "LOW" | "MEDIUM" | "HIGH";
    controlType: string;
    controlFrequency: string;
    systemId: string;
    systemCode: string;
    systemClient: string;
    enabled: boolean;
    createdAt: string;
    deactivatedAt: string | null;
    runCount: number;
    lastRunAt: string | null;
    lastRunStatus: string;
};

export type MappableControl = { id: string; code: string; description: string; severity: string; controlType: string; frequency: string };
export type MappableSystem = { id: string; sysId: string; client: string };
export type RunLog = { timestamp: string; level: string; message: string };

export const systemControlConfigApi = {
    list: () => call<ActionResult & { configs: SystemControlConfig[] }>("system-control-config", "listSystemControlConfigs"),

    listMappable: () =>
        call<ActionResult & { controls: MappableControl[]; systems: MappableSystem[] }>("system-control-config", "listMappableControlsAndSystems"),

    create: (controlId: string, systemId: string) =>
        call<ActionResult & { id: string }>("system-control-config", "createSystemControlConfig", { controlId, systemId }),

    setStatus: (id: string, enabled: boolean) =>
        call<ActionResult>("system-control-config", "setSystemControlConfigStatus", { id, enabled }),

    runNow: (id: string) =>
        call<ActionResult & { deviationsFound: number; alertsCreated: number }>("system-control-config", "runSystemControlConfigNow", { id }),

    remove: (id: string) => call<ActionResult>("system-control-config", "deleteSystemControlConfig", { id }),

    getDetail: (id: string) =>
        call<ActionResult & { detail: SystemControlConfig | null; logs: RunLog[] }>("system-control-config", "getSystemControlConfigDetail", { id }),
};

export type Organization = {
    id: string;
    orgCode: string;
    name: string;
    industry: string;
    region: string;
    country: string;
    primaryContact: string;
    email: string;
    phone: string;
    status: string;
    systemCount: number;
    createdAt: string;
};

export type OrgInput = {
    orgCode: string;
    name: string;
    industry: string;
    region: string;
    country: string;
    primaryContact: string;
    email: string;
    phone: string;
    status: string;
};

export type SystemEntry = {
    id: string;
    sysId: string;
    client: string;
    sysType: string;
    hostName: string;
    sysDetails: string;
    organizationId: string;
    organizationCode: string;
    organizationName: string;
    sector: string;
    platform: string;
    region: string;
    clientType: string;
    sysVersion: string;
    logonGroup: string;
    portNumber: number;
    instanceNo: string;
    status: string;
    endpoint: string;
    lastConnectionStatus: string;
};

export type SystemInput = {
    sysId: string;
    client: string;
    sysType: string;
    hostName: string;
    sysDetails: string;
    organizationId: string;
    sector: string;
    platform: string;
    region: string;
    clientType: string;
    sysVersion: string;
    logonGroup: string;
    portNumber: number;
    instanceNo: string;
    endpoint: string;
    credUserId: string;
    credPassword: string;
};

export const organizationApi = {
    list: () => call<ActionResult & { organizations: Organization[] }>("organization", "listOrganizations"),

    get: (id: string) => call<ActionResult & { organization: Organization | null }>("organization", "getOrganization", { id }),

    create: (input: OrgInput) => call<ActionResult & { id: string }>("organization", "createOrganization", input),

    update: (id: string, input: Omit<OrgInput, "orgCode">) => call<ActionResult>("organization", "updateOrganization", { id, ...input }),

    delete: (id: string) => call<ActionResult>("organization", "deleteOrganization", { id }),
};

export type JiraSettings = {
    enabled: boolean;
    siteUrl: string;
    email: string;
    projectKey: string;
    issueType: string;
    hasToken: boolean;
    statusCreated: string;
    statusInProgress: string;
    statusResolved: string;
};

export type JiraSettingsInput = Omit<JiraSettings, "hasToken"> & { apiToken: string };

export const jiraApi = {
    getSettings: (organizationId: string) => call<ActionResult & { settings: JiraSettings }>("organization", "getJiraSettings", { organizationId }),

    updateSettings: (organizationId: string, input: JiraSettingsInput) =>
        call<ActionResult>("organization", "updateJiraSettings", { organizationId, ...input }),

    getStatusOptions: (input: { organizationId: string; siteUrl: string; email: string; apiToken: string; projectKey: string }) =>
        call<ActionResult & { statuses: string[] }>("organization", "getJiraStatusOptions", input),
};

export const systemConfigApi = {
    list: () => call<ActionResult & { systems: SystemEntry[] }>("system-config", "listSystems"),

    create: (input: SystemInput) => call<ActionResult & { id: string }>("system-config", "createSystem", input),

    update: (id: string, input: Omit<SystemInput, "sysId">) => call<ActionResult>("system-config", "updateSystem", { id, ...input }),

    delete: (id: string) => call<ActionResult>("system-config", "deleteSystem", { id }),

    testConnection: (id: string) => call<ActionResult & { statusCode: number; latencyMs: number }>("system-config", "testSystemConnection", { id }),

    getSlaSettings: () => call<ActionResult & { settings: SlaSettings }>("system-config", "getSlaSettings"),

    updateSlaSettings: (input: SlaSettings) => call<ActionResult>("system-config", "updateSlaSettings", input),
};

export type SlaSettings = { reviewer1Days: number; reviewer2Days: number; escalationDelayDays: number };

export type AlertHeader = {
    id: string;
    controlId: string;
    controlDescription: string;
    systemId: string;
    client: string;
    organizationId: string;
    sector: string;
    region: string;
    platform: string;
    status: "Open" | "In Progress" | "Resolved";
    severity: string;
    deviationCount: number;
    alertDate: string;
    description: string;
};

export type DeviationFilters = {
    organizationId?: string;
    sector?: string;
    region?: string;
    platform?: string;
    systemId?: string;
    client?: string;
    controlId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
};

export type DeviationKpi = {
    totalIncidents: number;
    openItems: number;
    resolvedItems: number;
    auditedControls: number;
    complianceRate: string;
};

export type AlertItem = {
    id: string;
    sapObject: string;
    parameter: string;
    operator: string;
    expectedValue: string;
    actualValue: string;
    status: string;
    timestamp: string;
    message: string;
};

export type RunLogEntry = { id: string; level: string; message: string; timestamp: string };

export const deviationApi = {
    // 'All'/empty values are accepted as-is - the backend's matchesFilters
    // already treats them as "no filter", no need to strip them here.
    list: (filters: DeviationFilters) =>
        call<ActionResult & { headers: AlertHeader[]; kpi: DeviationKpi }>("deviation", "listDeviations", filters),

    getDetail: (alertId: string) =>
        call<ActionResult & { header: AlertHeader | null; items: AlertItem[] }>("deviation", "getDeviationDetail", { alertId }),

    getRunLogs: (alertId: string) => call<ActionResult & { logs: RunLogEntry[] }>("deviation", "getRunLogs", { alertId }),

    getComplianceInsights: () =>
        call<ActionResult & { totalChecks: number; passedChecks: number; rules: RuleCheckStat[] }>("deviation", "getComplianceInsights"),
};

// One rule on one system, aggregated over all of its run history.
export type RuleCheckStat = {
    controlId: string;
    controlDescription: string;
    controlSeverity: string;
    controlExists: boolean;
    systemId: string;
    client: string;
    systemExists: boolean;
    sapObject: string;
    parameter: string;
    operator: string;
    expectedValue: string;
    lastActualValue: string | null;
    lastPassed: boolean;
    lastUnreachable: boolean;
    lastMessage: string;
    lastCheckedAt: string;
    checkCount: number;
    failCount: number;
};

export type ReviewEntry = {
    id: string;
    alertItemId: string;
    alertId: string;
    controlId: string;
    controlDescription: string;
    systemId: string;
    client: string;
    sapObject: string;
    parameter: string;
    operator: string;
    actualValue: string;
    expectedValue: string;
    message: string;
    severity: string;
    generatedDate: string;

    reviewer1Status: "NEW" | "APPROVE" | "REMEDIATE";
    reviewer1Comment: string;
    reviewer1ByName: string;
    reviewer1At: string | null;

    reviewer2Status: "NEW" | "APPROVE" | "REMEDIATE";
    reviewer2Comment: string;
    reviewer2ByName: string;
    reviewer2At: string | null;

    ticketNumber: string;
    ticketLevel: number | null;
    ticketCreatedAt: string | null;
    ticketUrl: string;
    ticketStatus: string;
    ticketResolved: boolean;

    slaDeadline: string | null;
    daysPending: number | null;
    isOverdue: boolean;
    escalationDue: boolean;
};

export type AuditLogEntry = {
    id: string;
    createdAt: string;
    action: string;
    module: string;
    objectType: string;
    objectId: string;
    objectLabel: string;
    description: string;
    previousValue: string;
    newValue: string;
    result: "SUCCESS" | "FAILURE";
    systemId: string;
    controlId: string;
    performedBy: string;
    performedByRole: string;
};

export type AuditLogEventInput = {
    action: string;
    module: string;
    objectType?: string;
    objectId?: string;
    objectLabel?: string;
    description: string;
    previousValue?: string;
    newValue?: string;
    result?: "SUCCESS" | "FAILURE";
    systemId?: string;
    controlId?: string;
};

export const auditLogApi = {
    list: () => call<ActionResult & { logs: AuditLogEntry[] }>("audit-log", "listAuditLogs"),

    // Fire-and-forget - only for actions with no backend write to piggyback a
    // tx onto (e.g. viewing a review). Never awaited by callers.
    logEvent: (input: AuditLogEventInput) => call<ActionResult>("audit-log", "logEvent", { ...input }).catch(() => {}),
};

export const reviewApi = {
    listLevel1Queue: () => call<ActionResult & { reviews: ReviewEntry[] }>("review", "listLevel1Queue"),
    listLevel2Queue: () => call<ActionResult & { reviews: ReviewEntry[] }>("review", "listLevel2Queue"),
    listLevel1History: () => call<ActionResult & { reviews: ReviewEntry[] }>("review", "listLevel1History"),
    listLevel2History: () => call<ActionResult & { reviews: ReviewEntry[] }>("review", "listLevel2History"),

    getDetail: (reviewId: string) => call<ActionResult & { review: ReviewEntry | null }>("review", "getReviewDetail", { reviewId }),

    decideLevel1: (reviewId: string, decision: "APPROVE" | "REMEDIATE", comment: string) =>
        call<ActionResult & { ticketNumber: string | null }>("review", "decideLevel1", { reviewId, decision, comment }),

    decideLevel2: (reviewId: string, decision: "APPROVE" | "REMEDIATE", comment: string) =>
        call<ActionResult & { ticketNumber: string | null }>("review", "decideLevel2", { reviewId, decision, comment }),
};

export type NotificationEntry = {
    id: string;
    title: string;
    message: string;
    category: "TASK" | "REMINDER" | "ALERT" | "TICKET";
    priority: "HIGH" | "MEDIUM" | "LOW";
    read: boolean;
    targetPage: string | null;
    targetRecord: string | null;
    icon: string;
    iconClass: string;
    createdAt: string;
};

export const notificationApi = {
    list: () => call<ActionResult & { notifications: NotificationEntry[] }>("notifications", "listNotifications"),
    markAsRead: (id: string) => call<ActionResult>("notifications", "markAsRead", { id }),
    clearAll: () => call<ActionResult>("notifications", "clearAll"),
};

export type ProfileEntry = {
    id: string;
    name: string;
    email: string;
    phone: string;
    department: string;
    organization: string;
    role: string;
    status: string;
};

// getProfile's response is flat (success/message/id/name/... at the top
// level), not nested under a "profile" key - matches profile-service.cds.
export const profileApi = {
    get: () => call<ActionResult & ProfileEntry>("profile", "getProfile"),

    update: (input: { name: string; phone: string; department: string; organization: string }) =>
        call<ActionResult>("profile", "updateProfile", input),

    changePassword: (currentPassword: string, newPassword: string) =>
        call<ActionResult>("profile", "changePassword", { currentPassword, newPassword }),
};

export type AdminUser = {
    id: string;
    name: string;
    email: string;
    organization: string;
    role: string;
    status: string;
    createdAt: string;
};

// listUsers is the one action that `returns array of {...}` instead of
// `{success,message,...}` - CAP's OData JSON adapter wraps that as
// `{ value: [...] }`, so it doesn't fit the ActionResult shape every other
// call here does. AdminService's actions don't declare performedBy/
// performedByRole, so no  - CAP 400s on unknown action params.
export const adminApi = {
    listUsers: () => call<{ value: AdminUser[] }>("admin", "listUsers"),

    createUser: (input: { name: string; email: string; password: string; roleCode: string; organization: string }) =>
        call<ActionResult & { userId: string | null }>("admin", "createUser", input),

    removeUser: (userId: string) => call<ActionResult>("admin", "removeUser", { userId }),

    resetPassword: (userId: string, newPassword: string) => call<ActionResult>("admin", "resetPassword", { userId, newPassword }),
};
