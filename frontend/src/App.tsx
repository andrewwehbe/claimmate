import { Navigate, Route, Routes } from "react-router-dom";

import { SideNav } from "./components/SideNav";
import { ClaimDetailScreen } from "./screens/ClaimDetailScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { DenialsScreen } from "./screens/DenialsScreen";
import { QueueScreen } from "./screens/QueueScreen";

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden bg-white text-sm text-ink">
      <SideNav />
      <main className="flex min-w-0 flex-1 flex-col">
        <Routes>
          <Route path="/" element={<Navigate to="/queue" replace />} />
          <Route path="/queue" element={<QueueScreen />} />
          <Route path="/claims/:id" element={<ClaimDetailScreen />} />
          <Route path="/denials" element={<DenialsScreen />} />
          <Route path="/dashboard" element={<DashboardScreen />} />
          <Route path="*" element={<Navigate to="/queue" replace />} />
        </Routes>
      </main>
    </div>
  );
}
