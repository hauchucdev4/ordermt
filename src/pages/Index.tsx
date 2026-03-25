import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function Index() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const roleRoutes: Record<string, string> = {
    superadmin: "/superadmin",
    admin: "/admin",
    manager: "/manager",
    staff: "/staff",
    chef: "/chef",
  };

  return <Navigate to={roleRoutes[profile?.role || ""] || "/login"} replace />;
}
