import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import RecipeManagement from "@/components/restaurant/RecipeManagement";
import RecipeBatchPanel from "@/components/restaurant/RecipeBatchPanel";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function ChefRecipesPage() {
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.restaurant_id) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("name")
        .eq("id", profile.restaurant_id!)
        .single();
      setName(data?.name ?? "Nhà hàng");
      setLoading(false);
    })();
  }, [profile?.restaurant_id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile?.restaurant_id) {
    return (
      <div className="p-4">
        <Card className="p-10 text-center text-muted-foreground">
          Tài khoản của bạn chưa được gán vào nhà hàng nào.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/chef">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Công thức &amp; Định lượng</h1>
          <p className="text-sm text-muted-foreground">{name}</p>
        </div>
      </div>
      <RecipeManagement restaurantId={profile.restaurant_id} restaurantName={name} canEdit={false} />
      <RecipeBatchPanel restaurantId={profile.restaurant_id} restaurantName={name} />

    </div>
  );
}
