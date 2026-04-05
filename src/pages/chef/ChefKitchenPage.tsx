import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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

  const fetchItems = useCallback(async () => {
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
      mapped.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setItems(mapped);
    }
    setLoading(false);
  }, [profile?.restaurant_id]);

  useEffect(() => {
    fetchItems();
    if (!profile?.restaurant_id) return;

    const setupChannel = () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      const channel = supabase
        .channel(`kitchen-realtime-${profile.restaurant_id}-${Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => { playSound(); fetchItems(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchItems())
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
  }, [profile?.restaurant_id]);

  const updateStatus = async (itemId: string, newStatus: "preparing" | "done") => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: newStatus } : i));
    await supabase.from("order_items").update({ status: newStatus }).eq("id", itemId);
  };

  const newItems = items.filter(i => i.status === "new");
  const preparingItems = items.filter(i => i.status === "preparing");
  const doneItems = items.filter(i => i.status === "done");

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  const ItemCard = ({ item, action }: { item: KitchenItem; action?: (item: KitchenItem) => void }) => (
    <div className="aspect-square rounded-lg border bg-card p-1.5 flex flex-col items-center justify-center text-center gap-0.5 animate-fade-in">
      <p className="font-medium text-xs leading-tight line-clamp-2">{item.menu_item_name}</p>
      <p className="text-[10px] text-muted-foreground">x{item.quantity}</p>
      <p className="text-[10px] text-muted-foreground">{item.table_name}</p>
      {action && (
        <Button size="sm" variant={item.status === "new" ? "default" : "outline"} className="h-6 text-[10px] px-2 mt-0.5" onClick={() => action(item)}>
          {item.status === "new" ? "Nhận" : "Xong"}
        </Button>
      )}
    </div>
  );

  const ItemRow = ({ item, action }: { item: KitchenItem; action?: (item: KitchenItem) => void }) => (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm animate-fade-in">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium truncate">{item.menu_item_name}</span>
          <span className="text-muted-foreground shrink-0">x{item.quantity}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{item.table_name}</span>
          <span>•</span>
          <span>{new Date(item.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        {item.note && <p className="text-[11px] text-muted-foreground italic truncate">{item.note}</p>}
      </div>
      {action && (
        <Button size="default" variant={item.status === "new" ? "default" : "outline"} className="shrink-0 h-9 text-sm px-4 font-medium" onClick={() => action(item)}>
          {item.status === "new" ? "Nhận" : "Xong"}
        </Button>
      )}
    </div>
  );

  const Column = ({ title, emoji, items: colItems, action }: { title: string; emoji: string; items: KitchenItem[]; action?: (item: KitchenItem) => void }) => (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-sm">{emoji}</span>
        <span className="text-sm font-semibold">{title}</span>
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 ml-auto">{colItems.length}</Badge>
      </div>
      {/* Mobile: grid ô vuông */}
      <div className="grid grid-cols-3 gap-1.5 lg:hidden max-h-[calc(100vh-120px)] overflow-y-auto">
        {colItems.map(item => <ItemCard key={item.id} item={item} action={action} />)}
      </div>
      {/* Desktop: danh sách dọc */}
      <div className="hidden lg:block space-y-2.5 max-h-[calc(100vh-120px)] overflow-y-auto pr-1">
        {colItems.map(item => <ItemRow key={item.id} item={item} action={action} />)}
      </div>
      {colItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Trống</p>}
    </div>
  );

  return (
    <div className="p-2 md:p-4">
      <div className="flex flex-col lg:flex-row gap-4">
        <Column title="Món mới" emoji="🆕" items={newItems} action={(item) => updateStatus(item.id, "preparing")} />
        <Column title="Đang làm" emoji="🍳" items={preparingItems} action={(item) => updateStatus(item.id, "done")} />
        <Column title="Hoàn thành" emoji="✅" items={doneItems} />
      </div>
    </div>
  );
}
