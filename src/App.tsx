import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SidebarProvider } from '@/context/SidebarContext';
import { LocationFilterProvider } from '@/context/LocationFilterContext';
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Rooms from "./pages/Rooms";
import Planning from "./pages/Planning";
import Reservations from "./pages/Reservations";
import Tenants from "./pages/Tenants";
import Incidents from "./pages/Incidents";
import Tasks from "./pages/Tasks";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Notifications from "./pages/Notifications";
import Invoices from "./pages/Invoices";
import FinancialReport from "./pages/reports/FinancialReport";
import RevenueReport from "./pages/reports/RevenueReport";
import OccupancyReport from "./pages/reports/OccupancyReport";
import SyncDashboard from "./pages/SyncDashboard";
import NotFound from "./pages/NotFound";
import Users from "./pages/Users";
// Import new accounting components
import GeneralLedger from "./components/accounting/GeneralLedger";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <SidebarProvider>
          <LocationFilterProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={<ProtectedRoute allowedRoles={['ADMIN', 'AGENT_RES', 'AGENT_OP']}><Index /></ProtectedRoute>} />
                <Route path="/rooms" element={<ProtectedRoute allowedRoles={['ADMIN', 'AGENT_RES', 'AGENT_OP', 'SERVICE_CLIENT']}><Rooms /></ProtectedRoute>} />
                <Route path="/planning" element={<ProtectedRoute allowedRoles={['ADMIN', 'AGENT_RES', 'AGENT_OP', 'SERVICE_CLIENT']}><Planning /></ProtectedRoute>} />
                <Route path="/reservations" element={<ProtectedRoute allowedRoles={['ADMIN', 'AGENT_RES', 'AGENT_OP']}><Reservations /></ProtectedRoute>} />
                <Route path="/tenants" element={<ProtectedRoute allowedRoles={['ADMIN', 'AGENT_RES', 'AGENT_OP']}><Tenants /></ProtectedRoute>} />
                <Route path="/incidents" element={<ProtectedRoute allowedRoles={['ADMIN', 'AGENT_RES', 'AGENT_OP']}><Incidents /></ProtectedRoute>} />
                <Route path="/tasks" element={<ProtectedRoute allowedRoles={['ADMIN', 'AGENT_RES', 'AGENT_OP']}><Tasks /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute allowedRoles={['ADMIN']}><Users /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute allowedRoles={['ADMIN']}><Reports /></ProtectedRoute>} />
                <Route path="/reports/revenue" element={<ProtectedRoute allowedRoles={['ADMIN']}><RevenueReport /></ProtectedRoute>} />
                <Route path="/reports/occupancy" element={<ProtectedRoute allowedRoles={['ADMIN']}><OccupancyReport /></ProtectedRoute>} />
                <Route path="/reports/financial-report" element={<ProtectedRoute allowedRoles={['ADMIN']}><FinancialReport /></ProtectedRoute>} />
                {/* Synchronization Dashboard */}
                <Route path="/sync-dashboard" element={<ProtectedRoute allowedRoles={['ADMIN']}><SyncDashboard /></ProtectedRoute>} />
                {/* New accounting routes */}
                <Route path="/reports/general-ledger" element={<ProtectedRoute allowedRoles={['ADMIN']}><GeneralLedger /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/invoices" element={<ProtectedRoute allowedRoles={['ADMIN', 'AGENT_RES', 'AGENT_OP']}><Invoices /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute allowedRoles={['ADMIN', 'AGENT_RES', 'AGENT_OP']}><Notifications /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </LocationFilterProvider>
        </SidebarProvider>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
