import { useAuth } from "@/contexts/AuthContext";
import OrderStation from "@/components/restaurant/OrderStation";
import { Loader2 } from "lucide-react";

export default function StaffOrderPage() {
  const { profile } = useAuth();

  if (!profile?.restaurant_id) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-bold mb-4">Chọn bàn</h1>
      <OrderStation restaurantId={profile.restaurant_id} />
    </div>
  );
}
