import { Outlet } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Users, UserCheck, UserPlus, Settings } from "lucide-react";

const navItems = [
  { title: "Quản lý Admin", url: "/superadmin", icon: Users },
  { title: "Duyệt đăng ký", url: "/superadmin/approvals", icon: UserCheck },
  { title: "Tạo Admin", url: "/superadmin/create", icon: UserPlus },
  { title: "Cài đặt", url: "/superadmin/settings", icon: Settings },
];

export default function SuperAdminLayout() {
  return (
    <DashboardLayout navItems={navItems} title="SuperAdmin">
      <Outlet />
    </DashboardLayout>
  );
}
