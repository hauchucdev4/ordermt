/** ODA4 — Page: Thanh toán (Manager). Data lấy qua hook. */
import { useAuth } from "@/contexts/AuthContext";
import { useRestaurantName } from "@/hooks/useRestaurant";
import BillPayment from "@/components/restaurant/BillPayment";
import { Loader2 } from "lucide-react";

export default function ManagerBillPage() {
  const { profile } = useAuth();
  const { name } = useRestaurantName(profile?.restaurant_id);

  if (!profile?.restaurant_id) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Thanh toán</h1>
      <BillPayment restaurantId={profile.restaurant_id} restaurantName={name} />
    </div>
  );
}
