import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { PortalShell } from "./portal/PortalShell";
import { ClaimDetailScreen } from "./screens/ClaimDetailScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { DenialsScreen } from "./screens/DenialsScreen";
import { LandingScreen } from "./screens/LandingScreen";
import { QueueScreen } from "./screens/QueueScreen";
import { AppealsScreen } from "./screens/ops/AppealsScreen";
import { ClientsScreen } from "./screens/ops/ClientsScreen";
import { PracticeClaims } from "./screens/practice/PracticeClaims";
import { PracticeDashboard } from "./screens/practice/PracticeDashboard";
import { PracticeIntegration } from "./screens/practice/PracticeIntegration";
import { SignupWizard } from "./screens/practice/SignupWizard";
import { PayerInbox } from "./screens/payer/PayerInbox";
import { PayerRemittances } from "./screens/payer/PayerRemittances";

/** Preserves the :id segment when redirecting legacy claim URLs. */
function LegacyClaimRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/ops/claims/${id}`} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingScreen />} />
      <Route path="/practice/signup" element={<SignupWizard />} />

      {/* Practice portal */}
      <Route path="/practice" element={<PortalShell portal="practice" />}>
        <Route index element={<PracticeDashboard />} />
        <Route path="claims" element={<PracticeClaims />} />
        <Route path="integration" element={<PracticeIntegration />} />
      </Route>

      {/* Operations portal */}
      <Route path="/ops" element={<PortalShell portal="ops" />}>
        <Route index element={<Navigate to="/ops/queue" replace />} />
        <Route path="queue" element={<QueueScreen />} />
        <Route path="claims/:id" element={<ClaimDetailScreen />} />
        <Route path="denials" element={<DenialsScreen />} />
        <Route path="dashboard" element={<DashboardScreen />} />
        <Route path="clients" element={<ClientsScreen />} />
        <Route path="appeals" element={<AppealsScreen />} />
      </Route>

      {/* Payer portal */}
      <Route path="/payer" element={<PortalShell portal="payer" />}>
        <Route index element={<PayerInbox />} />
        <Route path="remittances" element={<PayerRemittances />} />
      </Route>

      {/* Legacy top-level routes -> ops */}
      <Route path="/queue" element={<Navigate to="/ops/queue" replace />} />
      <Route path="/claims/:id" element={<LegacyClaimRedirect />} />
      <Route path="/denials" element={<Navigate to="/ops/denials" replace />} />
      <Route
        path="/dashboard"
        element={<Navigate to="/ops/dashboard" replace />}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
