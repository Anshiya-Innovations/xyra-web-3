import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router";
import { ScrollToTop } from "./components/common/ScrollToTop";
import ProtectedLayout from "./layout/ProtectedLayout";
import Login from "./pages/AuthPages/Login";
import NotFound from "./pages/OtherPage/NotFound";
import AiInsights from "./pages/Admin/AiInsights";
import AlertItem from "./pages/Admin/AlertItem";
import AuditLogs from "./pages/Admin/AuditLogs";
import Dashboard from "./pages/Admin/Dashboard";
import DeviationReport from "./pages/Admin/DeviationReport";
import Reports from "./pages/Admin/Reports";
import SoxCompliance from "./pages/Admin/SoxCompliance";
import AccessManagement from "./pages/Admin/AccessManagement";
import ControlEditor from "./pages/Admin/ControlEditor";
import Controls from "./pages/Admin/Controls";
import Organization from "./pages/Admin/Organization";
import OrganizationDetails from "./pages/Admin/OrganizationDetails";
import SystemConfiguration from "./pages/Admin/SystemConfiguration";
import SystemControlConfig from "./pages/Admin/SystemControlConfig";
import SystemControlConfigDetails from "./pages/Admin/SystemControlConfigDetails";
import Auditor from "./pages/Auditor/Auditor";
import EscalationManager from "./pages/EscalationManager/EscalationManager";
import Profile from "./pages/Profile";
import ReviewerQueue from "./pages/Reviewer/ReviewerQueue";

export default function App() {
  return (
    // import.meta.env.BASE_URL mirrors vite.config.ts's `base` - "/" locally,
    // "/xyra/" in the GitHub Pages build (VITE_BASE_PATH).
    <Router basename={import.meta.env.BASE_URL}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/controls" element={<Controls />} />
          <Route path="/controls/new" element={<ControlEditor />} />
          <Route path="/controls/:controlId" element={<ControlEditor />} />
          <Route path="/system-control-config" element={<SystemControlConfig />} />
          <Route path="/system-control-config/:configId" element={<SystemControlConfigDetails />} />
          <Route path="/deviation-report" element={<DeviationReport />} />
          <Route path="/deviation-report/:alertId" element={<AlertItem />} />
          <Route path="/ai-insights" element={<AiInsights />} />
          <Route path="/sox-compliance" element={<SoxCompliance />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/configuration" element={<SystemConfiguration />} />
          <Route path="/access-management" element={<AccessManagement />} />
          <Route path="/organization" element={<Organization />} />
          <Route path="/organization/:orgId" element={<OrganizationDetails />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route element={<ProtectedLayout allow={["REVIEWER"]} />}>
          <Route path="/reviewer-1" element={<ReviewerQueue key={1} level={1} />} />
          <Route path="/reviewer-2" element={<ReviewerQueue key={2} level={2} />} />
        </Route>

        <Route element={<ProtectedLayout allow={["ESCALATION_MANAGER"]} />}>
          <Route path="/escalation-manager" element={<EscalationManager />} />
        </Route>

        <Route element={<ProtectedLayout allow={["AUDITOR"]} />}>
          <Route path="/auditor" element={<Auditor />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
