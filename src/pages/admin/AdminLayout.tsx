import { Outlet } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Store, BarChart3, Settings } from "lucide-react";

const navItems = [
  { title: "Nhà hàng của tôi", url: "/admin", icon: Store },
  { title: "Báo cáo doanh thu", url: "/admin/reports", icon: BarChart3 },
  { title: "Cài đặt", url: "/admin/settings", icon: Settings },
];

export default function AdminLayout() {
  return (
    <DashboardLayout navItems={navItems} title="Admin">
      <Outlet />
    </DashboardLayout>
  );
}
