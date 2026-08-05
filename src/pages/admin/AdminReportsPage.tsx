/** ODA8 — Page: Báo cáo doanh thu (Admin). Chỉ layout + chọn tenant. */
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import RevenueReport from "@/components/restaurant/RevenueReport";
import { useMyRestaurants } from "@/hooks/useMyRestaurants";

export default function AdminReportsPage() {
  const { restaurants, loading } = useMyRestaurants({ orderBy: "name" });
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (!selectedId && restaurants.length) setSelectedId(restaurants[0].id);
  }, [restaurants, selectedId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Báo cáo Doanh thu</h1>
        {restaurants.length > 1 && (
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {restaurants.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {restaurants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Chưa có nhà hàng nào</p>
          </CardContent>
        </Card>
      ) : selectedId ? (
        <RevenueReport restaurantId={selectedId} />
      ) : null}
    </div>
  );
}
