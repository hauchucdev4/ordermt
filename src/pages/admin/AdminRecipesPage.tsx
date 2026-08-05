/** DLA1 — Page: Công thức & Định lượng (Admin). Chỉ layout + chọn tenant. */
import { useEffect, useState } from "react";
import RecipeManagement from "@/components/restaurant/RecipeManagement";
import { useMyRestaurants } from "@/hooks/useMyRestaurants";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

export default function AdminRecipesPage() {
  const { restaurants, loading } = useMyRestaurants();
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    if (!selected && restaurants.length) setSelected(restaurants[0].id);
  }, [restaurants, selected]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!restaurants.length) {
    return (
      <Card className="p-10 text-center text-muted-foreground">
        Bạn cần tạo nhà hàng trước khi quản lý công thức &amp; định lượng.
      </Card>
    );
  }

  const current = restaurants.find((r) => r.id === selected);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Công thức &amp; Định lượng</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý định lượng nguyên vật liệu từng món, xuất/nhập bằng Excel.
          </p>
        </div>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Chọn nhà hàng" />
          </SelectTrigger>
          <SelectContent>
            {restaurants.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {current && (
        <RecipeManagement key={current.id} restaurantId={current.id} restaurantName={current.name} />
      )}
    </div>
  );
}
