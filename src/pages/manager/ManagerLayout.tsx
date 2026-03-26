import { Outlet } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { ShoppingBag, ChefHat, Users, BarChart3, Settings, CreditCard } from "lucide-react";

export default function ManagerLayout() {
  const navItems = [
    { title: "Order", url: "/manager", icon: ShoppingBag },
    { title: "Bếp", url: "/manager/kitchen", icon: ChefHat },
    { title: "Thanh toán", url: "/manager/billing", icon: CreditCard },
    { title: "Nhân viên", url: "/manager/staff", icon: Users },
    { title: "Doanh thu", url: "/manager/reports", icon: BarChart3 },
    { title: "Cài đặt", url: "/manager/settings", icon: Settings },
  ];

  return (
    <DashboardLayout navItems={navItems} title="Manager">
      <Outlet />
    </DashboardLayout>
  );
}
