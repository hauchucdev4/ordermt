import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShoppingBag } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Order = Database["public"]["Tables"]["orders"]["Row"];

interface OrderWithDetails extends Order {
  table_name?: string;
  items?: { name: string; quantity: number; status: string }[];
}

export default function OrdersView({ restaurantId }: { restaurantId: string }) {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const initialLoadRef = useRef(true);

  const playSound = (type: "new" | "update" = "new") => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = type === "new" ? 880 : 600;
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  const fetchOrders = useCallback(async () => {
    if (initialLoadRef.current) setLoading(true);
    const { data: ordersData } = await supabase
      .from("orders").select("*").eq("restaurant_id", restaurantId).eq("status", "open").order("created_at", { ascending: false });

    if (!ordersData || ordersData.length === 0) { setOrders([]); setLoading(false); return; }

    const tableIds = [...new Set(ordersData.map(o => o.table_id))];
    const { data: tablesData } = await supabase.from("tables").select("id, name").in("id", tableIds);
    const tableMap = new Map(tablesData?.map(t => [t.id, t.name]) || []);

    const orderIds = ordersData.map(o => o.id);
    const { data: orderItems } = await supabase.from("order_items").select("order_id, quantity, status, menu_item_id").in("order_id", orderIds);

    const menuItemIds = [...new Set(orderItems?.map(oi => oi.menu_item_id) || [])];
    const { data: menuItems } = menuItemIds.length > 0
      ? await supabase.from("menu_items").select("id, name").in("id", menuItemIds)
      : { data: [] };
    const menuMap = new Map<string, string>(menuItems?.map(m => [m.id, m.name] as [string, string]) || []);

    setOrders(ordersData.map(o => ({
      ...o,
      table_name: tableMap.get(o.table_id) || "Bàn ?",
      items: (orderItems || []).filter(oi => oi.order_id === o.id)
        .map(oi => ({ name: menuMap.get(oi.menu_item_id) || "?", quantity: oi.quantity, status: oi.status as string })),
    })));
    setLoading(false);
    initialLoadRef.current = false;
  }, [restaurantId]);

  useEffect(() => {
    fetchOrders();

    const setupChannel = () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      const channel = supabase
        .channel(`orders-view-${restaurantId}-${Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, (payload) => {
          if (payload.eventType === "INSERT") playSound("new");
          else if (payload.eventType === "UPDATE") playSound("update");
          fetchOrders();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") setTimeout(setupChannel, 3000);
        });
      channelRef.current = channel;
    };
    setupChannel();

    const heartbeat = setInterval(() => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); setupChannel(); }
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(heartbeat);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [restaurantId]);

  const statusLabel = (s: string) => {
    if (s === "new") return "🆕 Mới";
    if (s === "preparing") return "🍳 Đang làm";
    return "✅ Xong";
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (orders.length === 0) {
    return (
      <Card><CardContent className="flex flex-col items-center justify-center py-12">
        <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Chưa có order nào đang mở</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {orders.map(o => (
        <Card key={o.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{o.table_name}</span>
              <Badge variant="outline">{new Date(o.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {o.items?.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span>{item.name} x{item.quantity}</span>
                <span className="text-xs">{statusLabel(item.status)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
