import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ChefHat } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];

interface KitchenItem extends OrderItem {
  menu_item_name: string;
  table_name: string;
}

export default function ChefKitchenPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<KitchenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<AudioContext | null>(null);

  const playSound = () => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  };

  const fetchItems = async () => {
    if (!profile?.restaurant_id) return;
    const { data } = await supabase
      .from("order_items")
      .select(`*, orders!inner(restaurant_id, table_id, tables:table_id(name)), menu_items!inner(name)`)
      .eq("orders.restaurant_id", profile.restaurant_id)
      .eq("orders.status", "open")
      .order("created_at", { ascending: true });

    if (data) {
      const mapped = data.map((item: any) => ({
        ...item,
        menu_item_name: item.menu_items?.name || "",
        table_name: item.orders?.tables?.name || "",
      }));
      setItems(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();

    if (!profile?.restaurant_id) return;
    const channel = supabase
      .channel("kitchen-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        playSound();
        fetchItems();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.restaurant_id]);

  const updateStatus = async (itemId: string, newStatus: "preparing" | "done") => {
    await supabase.from("order_items").update({ status: newStatus }).eq("id", itemId);
    fetchItems();
  };

  const newItems = items.filter(i => i.status === "new");
  const preparingItems = items.filter(i => i.status === "preparing");
  const doneItems = items.filter(i => i.status === "done");

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const Column = ({ title, emoji, items: colItems, action }: { title: string; emoji: string; items: KitchenItem[]; action?: (item: KitchenItem) => void }) => (
    <div className="flex-1 min-w-[280px]">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span>{emoji}</span> {title}
        <Badge variant="secondary" className="ml-auto">{colItems.length}</Badge>
      </h2>
      <div className="space-y-3">
        {colItems.map(item => (
          <Card key={item.id} className="animate-fade-in">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{item.menu_item_name}</p>
                  <p className="text-sm text-muted-foreground">{item.table_name} • x{item.quantity}</p>
                  {item.note && <p className="text-xs text-muted-foreground italic mt-1">{item.note}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(item.created_at).toLocaleTimeString("vi-VN")}
                  </p>
                </div>
                {action && (
                  <Button size="sm" onClick={() => action(item)}>
                    {item.status === "new" ? "Nhận món" : "Đã xong"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {colItems.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Trống</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col lg:flex-row gap-6">
        <Column title="Món Mới" emoji="🆕" items={newItems} action={(item) => updateStatus(item.id, "preparing")} />
        <Column title="Đang làm" emoji="🍳" items={preparingItems} action={(item) => updateStatus(item.id, "done")} />
        <Column title="Hoàn thành" emoji="✅" items={doneItems} />
      </div>
    </div>
  );
}
