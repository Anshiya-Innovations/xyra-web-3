import { Navigate } from "react-router";
import { getSession } from "@/lib/session";
import AppLayout from "./AppLayout";

// Reviewer/Escalation Manager/Auditor each have one real destination (their
// sections are tabs inside that page), so they get the header only, no sidebar.
const SINGLE_PAGE_ROLES = ["REVIEWER", "ESCALATION_MANAGER", "AUDITOR"];

export default function ProtectedLayout({ allow }: { allow?: string[] }) {
  const session = getSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Backend has no per-role access control on these actions (shared queues,
  // no reviewer-pool model - see lib/review_engine's own comment) - this is
  // a UX guard only, not a real security boundary.
  if (allow && !allow.includes(session.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <AppLayout hideSidebar={SINGLE_PAGE_ROLES.includes(session.role)} />;
}
