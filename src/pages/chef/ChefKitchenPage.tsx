import { useAuth } from "@/contexts/AuthContext";
import KitchenView from "@/components/restaurant/KitchenView";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export default function ChefKitchenPage() {
  const { profile } = useAuth();

  if (!profile?.restaurant_id) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-2 md:p-4">
      <KitchenView restaurantId={profile.restaurant_id} />
    </div>
  );
}
