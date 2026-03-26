import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import BillPayment from "@/components/restaurant/BillPayment";
import { Loader2 } from "lucide-react";

export default function ManagerBillPage() {
  const { profile } = useAuth();
  const [restaurantName, setRestaurantName] = useState("");

  useEffect(() => {
    if (!profile?.restaurant_id) return;
    supabase.from("restaurants").select("name").eq("id", profile.restaurant_id).single()
      .then(({ data }) => { if (data) setRestaurantName(data.name); });
  }, [profile?.restaurant_id]);

  if (!profile?.restaurant_id) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Thanh toán</h1>
      <BillPayment restaurantId={profile.restaurant_id} restaurantName={restaurantName} />
    </div>
  );
}
