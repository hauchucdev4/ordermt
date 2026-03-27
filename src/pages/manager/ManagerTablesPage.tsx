import { useAuth } from "@/contexts/AuthContext";
import TableManagement from "@/components/restaurant/TableManagement";
import { Loader2 } from "lucide-react";

export default function ManagerTablesPage() {
  const { profile } = useAuth();

  if (!profile?.restaurant_id) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Quản lý Bàn</h1>
      <TableManagement restaurantId={profile.restaurant_id} />
    </div>
  );
}
