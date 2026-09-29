import { useAuth } from "@/contexts/AuthContext";
import ItemHistory from "@/components/restaurant/ItemHistory";
import { Loader2 } from "lucide-react";

export default function ItemHistoryPage() {
  const { profile } = useAuth();
  if (!profile?.restaurant_id) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  return (
    <div className="p-4 md:p-6">
      <ItemHistory restaurantId={profile.restaurant_id} />
    </div>
  );
}
