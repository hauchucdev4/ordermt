import { useAuth } from "@/contexts/AuthContext";
import RevenueReport from "@/components/restaurant/RevenueReport";
import { Loader2 } from "lucide-react";

export default function ManagerReportsPage() {
  const { profile } = useAuth();

  if (!profile?.restaurant_id) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Báo cáo Doanh thu</h1>
      <RevenueReport restaurantId={profile.restaurant_id} />
    </div>
  );
}
