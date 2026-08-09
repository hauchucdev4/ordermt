import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import RecipeManagement from "@/components/restaurant/RecipeManagement";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

type Restaurant = { id: string; name: string };

export default function AdminRecipesPage() {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("admin_id", user.id)
        .order("created_at");
      setRestaurants(data ?? []);
      if (data?.length) setSelected(data[0].id);
      setLoading(false);
    })();
  }, [user]);

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
        <>
          <RecipeManagement key={current.id} restaurantId={current.id} restaurantName={current.name} />
          <RecipeBatchPanel key={`b-${current.id}`} restaurantId={current.id} restaurantName={current.name} />
        </>
      )}

    </div>
  );
}
