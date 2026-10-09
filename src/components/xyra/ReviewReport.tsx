import Button from "@/components/ui/button/Button";
import { AlertContext, formatTimestamp } from "@/components/xyra/AlertContext";
import { type BadgeColors, Card, DetailItem, PageHeader, XBadge } from "@/components/xyra/kit";
import { type ReviewEntry, reviewApi } from "@/lib/api-client";

const SEVERITY_BADGE_COLOR: Record<string, BadgeColors> = { critical: "error", high: "error", medium: "warning", low: "success" };
export const badgeColorFor = (status: string) => SEVERITY_BADGE_COLOR[(status || "").toLowerCase()] ?? "gray";
export const DECISION_BADGE_COLOR: Record<string, BadgeColors> = { APPROVE: "success", REMEDIATE: "error" };
export const DECISION_LABEL: Record<string, string> = { APPROVE: "Approved", REMEDIATE: "Rejected" };

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

// Human SLA wording from the backend's slaDeadline (already business-day
// adjusted): "Due in 3 days" / "Due in 5 hours" / "Overdue by 2 days". Amber
// once less than a day is left. `title` is the exact deadline for a tooltip.
export function slaLabel(
  review: Pick<ReviewEntry, "slaDeadline" | "isOverdue">,
  now = Date.now(),
): { text: string; color: BadgeColors; title: string } {
  if (!review.slaDeadline) return { text: "—", color: "gray", title: "No active SLA" };
  const deadline = new Date(review.slaDeadline).getTime();
  const diff = deadline - now;
  const title = `SLA deadline: ${new Date(deadline).toLocaleString()}`;
  const span = Math.abs(diff);
  const amount = span < DAY ? plural(Math.max(1, Math.floor(span / HOUR)), "hour") : plural(Math.floor(span / DAY), "day");
  if (diff < 0 || review.isOverdue) return { text: `Overdue by ${amount}`, color: "error", title };
  return { text: `Due in ${amount}`, color: diff < DAY ? "warning" : "success", title };
}

// Filter buckets matching slaLabel's colors exactly.
export const SLA_BUCKETS = ["Overdue", "Due within 24h", "On track"] as const;
export function slaBucket(review: Pick<ReviewEntry, "slaDeadline" | "isOverdue">): (typeof SLA_BUCKETS)[number] | null {
  const { color } = slaLabel(review);
  return color === "error" ? "Overdue" : color === "warning" ? "Due within 24h" : color === "success" ? "On track" : null;
}

export function SlaBadge({ review }: { review: Pick<ReviewEntry, "slaDeadline" | "isOverdue"> }) {
  const sla = slaLabel(review);
  return (
    <span title={sla.title}>
      <XBadge color={sla.color}>{sla.text}</XBadge>
    </span>
  );
}

// Every closed review is terminal at whichever level actually decided it -
// Level 2 rows always have a terminal reviewer2Status; Level 1-only rows
// (rejected before ever reaching Level 2) are terminal at reviewer1Status.
export function terminalStatus(review: ReviewEntry): ReviewEntry["reviewer1Status"] {
  return review.reviewer2Status !== "NEW" ? review.reviewer2Status : review.reviewer1Status;
}
export function terminalAt(review: ReviewEntry): string | null {
  return review.reviewer2Status !== "NEW" ? review.reviewer2At : review.reviewer1At;
}

// Every review that reached a final outcome: rejected at Level 1 (chain ends
// there) plus everything Level 2 decided. Level 1 approvals are left out -
// they're still open at Level 2 (or already counted via Level 2 history).
export async function listClosedReviews(): Promise<ReviewEntry[]> {
  const [l1h, l2h] = await Promise.all([reviewApi.listLevel1History(), reviewApi.listLevel2History()]);
  if (!l1h.success || !l2h.success) throw new Error(l1h.message || l2h.message || "Could not load reviews.");
  return [...l1h.reviews.filter((r) => r.reviewer1Status === "REMEDIATE"), ...l2h.reviews];
}

export function DecisionBadge({ status }: { status: ReviewEntry["reviewer1Status"] }) {
  if (status === "NEW") return <XBadge color="gray">Pending</XBadge>;
  return <XBadge color={DECISION_BADGE_COLOR[status] ?? "gray"}>{DECISION_LABEL[status] || status}</XBadge>;
}

function ReviewerSummary({
  title,
  status,
  by,
  at,
  comment,
}: {
  title: string;
  status: ReviewEntry["reviewer1Status"];
  by: string;
  at: string | null;
  comment: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/3">
      <div className="flex items-center justify-between gap-3">
        <h5 className="text-sm font-semibold text-gray-800 dark:text-white/90">{title}</h5>
        <DecisionBadge status={status} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <DetailItem label="Reviewed By">{by || "—"}</DetailItem>
        <DetailItem label="Review Date">{formatTimestamp(at)}</DetailItem>
      </div>
      <DetailItem label="Root Cause Analysis">{comment || "—"}</DetailItem>
    </div>
  );
}

// Read-only counterpart of the Reviewer detail page - same alert context, no
// RCA / signature / decision controls. Used by the personas that only oversee
// the review chain (Escalation Manager, Auditor).
export function ReviewReport({ review, parentLabel, onBack }: { review: ReviewEntry; parentLabel: string; onBack: () => void }) {
  const isClosed = review.reviewer1Status === "REMEDIATE" || review.reviewer2Status !== "NEW";
  const stage = isClosed ? "Closed" : review.reviewer1Status === "NEW" ? "Awaiting Level 1" : "Awaiting Level 2";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumbs={[parentLabel, `${review.controlId} Report`]}
        onBack={onBack}
        title={`${review.controlId} on ${review.systemId}`}
        description={review.controlDescription}
        actions={
          <>
            {review.escalationDue && <XBadge color="error">Escalation Due</XBadge>}
            <XBadge color={badgeColorFor(review.severity)}>{review.severity}</XBadge>
          </>
        }
      />

      <Card title="Review Status">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          <DetailItem label="Stage">{stage}</DetailItem>
          <DetailItem label="Generated Date">{formatTimestamp(review.generatedDate)}</DetailItem>
          <DetailItem label="Days Pending">{isClosed ? "—" : String(review.daysPending ?? 0)}</DetailItem>
          <DetailItem label="SLA">
            {isClosed ? "—" : `${slaLabel(review).text}${review.slaDeadline ? ` (${formatTimestamp(review.slaDeadline)})` : ""}`}
          </DetailItem>
        </div>
      </Card>

      <Card title="Review Chain">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ReviewerSummary
            title="Level 1 — Control Exception Reviewer"
            status={review.reviewer1Status}
            by={review.reviewer1ByName}
            at={review.reviewer1At}
            comment={review.reviewer1Comment}
          />
          <ReviewerSummary
            title="Level 2 — Manager Exception Reviewer"
            status={review.reviewer2Status}
            by={review.reviewer2ByName}
            at={review.reviewer2At}
            comment={review.reviewer2Comment}
          />
        </div>
      </Card>

      {review.ticketNumber && (
        <Card title="Remediation Ticket">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            <DetailItem label="Ticket">
              {review.ticketUrl ? (
                <a href={review.ticketUrl} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline dark:text-brand-400">
                  {review.ticketNumber}
                </a>
              ) : (
                review.ticketNumber
              )}
            </DetailItem>
            <DetailItem label="Ticket Status">{review.ticketStatus || (review.ticketResolved ? "Resolved" : "Open")}</DetailItem>
            <DetailItem label="Raised At">{review.ticketLevel ? `Level ${review.ticketLevel}` : "—"}</DetailItem>
            <DetailItem label="Created">{formatTimestamp(review.ticketCreatedAt)}</DetailItem>
          </div>
        </Card>
      )}

      <AlertContext alertId={review.alertId} />

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onBack}>
          Back to {parentLabel}
        </Button>
      </div>
    </div>
  );
}
