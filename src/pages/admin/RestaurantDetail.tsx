import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

import StaffManagement from "@/components/restaurant/StaffManagement";
import MenuManagement from "@/components/restaurant/MenuManagement";
import TableManagement from "@/components/restaurant/TableManagement";
import OrdersView from "@/components/restaurant/OrdersView";
import RevenueReport from "@/components/restaurant/RevenueReport";
import BillPayment from "@/components/restaurant/BillPayment";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

export default function RestaurantDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", id)
        .single();
      if (error) {
        toast({ title: "Lỗi", description: "Không tìm thấy nhà hàng", variant: "destructive" });
      }
      setRestaurant(data);
      setLoading(false);
    })();
  }, [id, user]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Không tìm thấy nhà hàng</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/admin">← Quay lại</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link to="/admin"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{restaurant.name}</h1>
          {restaurant.address && (
            <p className="text-sm text-muted-foreground">{restaurant.address}</p>
          )}
        </div>
      </div>

      <Tabs defaultValue="staff" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="staff">Nhân viên</TabsTrigger>
          <TabsTrigger value="menu">Thực đơn</TabsTrigger>
          <TabsTrigger value="tables">Bàn</TabsTrigger>
          <TabsTrigger value="orders">Order</TabsTrigger>
          <TabsTrigger value="billing">Thanh toán</TabsTrigger>
          <TabsTrigger value="reports">Doanh thu</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="mt-4">
          <StaffManagement restaurantId={restaurant.id} />
        </TabsContent>
        <TabsContent value="menu" className="mt-4">
          <MenuManagement restaurantId={restaurant.id} />
        </TabsContent>
        <TabsContent value="tables" className="mt-4">
          <TableManagement restaurantId={restaurant.id} />
        </TabsContent>
        <TabsContent value="orders" className="mt-4">
          <OrdersView restaurantId={restaurant.id} />
        </TabsContent>
        <TabsContent value="billing" className="mt-4">
          <BillPayment restaurantId={restaurant.id} restaurantName={restaurant.name} />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <RevenueReport restaurantId={restaurant.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
