import { useAuth } from "@/contexts/AuthContext";
import MenuManagement from "@/components/restaurant/MenuManagement";
import { Loader2 } from "lucide-react";

export default function ManagerMenuPage() {
  const { profile } = useAuth();

  if (!profile?.restaurant_id) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Quản lý Thực đơn</h1>
      <MenuManagement restaurantId={profile.restaurant_id} />
    </div>
  );
}
