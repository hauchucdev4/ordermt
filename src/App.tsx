import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import AccountSettings from "./pages/AccountSettings";
import NotFound from "./pages/NotFound";

// SuperAdmin
import SuperAdminLayout from "./pages/superadmin/SuperAdminLayout";
import AdminManagement from "./pages/superadmin/AdminManagement";
import AdminApprovals from "./pages/superadmin/AdminApprovals";
import CreateAdmin from "./pages/superadmin/CreateAdmin";

// Admin
import AdminLayout from "./pages/admin/AdminLayout";
import MyRestaurants from "./pages/admin/MyRestaurants";

// Manager
import ManagerLayout from "./pages/manager/ManagerLayout";

// Staff
import StaffLayout from "./pages/staff/StaffLayout";
import StaffOrderPage from "./pages/staff/StaffOrderPage";

// Chef
import ChefLayout from "./pages/chef/ChefLayout";
import ChefKitchenPage from "./pages/chef/ChefKitchenPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<LoginPage />} />

            {/* SuperAdmin */}
            <Route path="/superadmin" element={<ProtectedRoute allowedRoles={["superadmin"]}><SuperAdminLayout /></ProtectedRoute>}>
              <Route index element={<AdminManagement />} />
              <Route path="approvals" element={<AdminApprovals />} />
              <Route path="create" element={<CreateAdmin />} />
              <Route path="settings" element={<AccountSettings />} />
            </Route>

            {/* Admin */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminLayout /></ProtectedRoute>}>
              <Route index element={<MyRestaurants />} />
              <Route path="reports" element={<div className="text-muted-foreground">Báo cáo doanh thu (sắp có)</div>} />
              <Route path="settings" element={<AccountSettings />} />
            </Route>

            {/* Manager */}
            <Route path="/manager" element={<ProtectedRoute allowedRoles={["manager"]}><ManagerLayout /></ProtectedRoute>}>
              <Route index element={<StaffOrderPage />} />
              <Route path="kitchen" element={<ChefKitchenPage />} />
              <Route path="staff" element={<div className="text-muted-foreground">Quản lý nhân viên (sắp có)</div>} />
              <Route path="reports" element={<div className="text-muted-foreground">Báo cáo doanh thu (sắp có)</div>} />
              <Route path="settings" element={<AccountSettings />} />
            </Route>

            {/* Staff */}
            <Route path="/staff" element={<ProtectedRoute allowedRoles={["staff"]}><StaffLayout /></ProtectedRoute>}>
              <Route index element={<StaffOrderPage />} />
              <Route path="settings" element={<AccountSettings />} />
            </Route>

            {/* Chef */}
            <Route path="/chef" element={<ProtectedRoute allowedRoles={["chef"]}><ChefLayout /></ProtectedRoute>}>
              <Route index element={<ChefKitchenPage />} />
              <Route path="settings" element={<AccountSettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
