import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { playRealtimeAlert, primeRealtimeAudio } from "@/lib/realtimeAlerts";

type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];

interface KitchenItem extends OrderItem {
  menu_item_name: string;
  table_name: string;
}

interface KitchenViewProps {
  restaurantId: string;
}

export default function KitchenView({ restaurantId }: KitchenViewProps) {
  const [items, setItems] = useState<KitchenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const recentLocalUpdates = useRef<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousItemsRef = useRef<Array<{ id: string; status: string }>>([]);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from("order_items")
      .select(`*, orders!inner(restaurant_id, table_id, tables:table_id(name)), menu_items!inner(name)`)
      .eq("orders.restaurant_id", restaurantId)
      .eq("orders.status", "open")
      .order("created_at", { ascending: true });

    if (data) {
      const mapped = data.map((item: any) => ({
        ...item,
        menu_item_name: item.menu_items?.name || "",
        table_name: item.orders?.tables?.name || "",
      }));
      mapped.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const nextSnapshot = mapped.map((item: any) => ({ id: item.id, status: item.status }));
      const previousItems = previousItemsRef.current;

      if (previousItems.length > 0) {
        const previousMap = new Map(previousItems.map(item => [item.id, item.status]));
        const changedIds = nextSnapshot.filter(item => !previousMap.has(item.id) || previousMap.get(item.id) !== item.status).map(item => item.id);
        const hasNewItem = nextSnapshot.some(item => !previousMap.has(item.id));
        const onlyLocalUpdate = changedIds.length > 0 && changedIds.every(id => recentLocalUpdates.current.has(id));

        if (!onlyLocalUpdate) {
          if (hasNewItem) playRealtimeAlert("new");
          else if (changedIds.length > 0) playRealtimeAlert("update");
        }
      }

      previousItemsRef.current = nextSnapshot;
      setItems(mapped);
    }
    setLoading(false);
  }, [restaurantId]);

  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchItems(), 500);
  }, [fetchItems]);

  useEffect(() => {
    const detachAudioPrime = primeRealtimeAudio();
    fetchItems();

    const setupChannel = () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      const channel = supabase
        .channel(`kitchen-view-${restaurantId}-${Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, (payload) => {
          const changed = payload.new as any;
          const eventType = payload.eventType;

          if (eventType === "UPDATE" && changed?.id && recentLocalUpdates.current.has(changed.id)) {
            recentLocalUpdates.current.delete(changed.id);
            return;
          }

          debouncedFetch();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => debouncedFetch())
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setTimeout(setupChannel, 3000);
        });
      channelRef.current = channel;
    };
    setupChannel();

    const heartbeat = setInterval(() => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); setupChannel(); }
    }, 5 * 60 * 1000);
    const poller = setInterval(fetchItems, 2500);

    return () => {
      detachAudioPrime();
      clearInterval(heartbeat);
      clearInterval(poller);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [restaurantId, fetchItems, debouncedFetch]);

  const updateStatus = async (itemId: string, newStatus: "preparing" | "done") => {
    recentLocalUpdates.current.add(itemId);
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: newStatus } : i));
    await supabase.from("order_items").update({ status: newStatus }).eq("id", itemId);
    setTimeout(() => recentLocalUpdates.current.delete(itemId), 3000);
  };

  const newItems = items.filter(i => i.status === "new");
  const preparingItems = items.filter(i => i.status === "preparing");
  const doneItems = items.filter(i => i.status === "done");

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  const ItemRow = ({ item, action, theme }: { item: KitchenItem; action?: (item: KitchenItem) => void; theme: { card: string; btn: string } }) => (
    <div className={`flex items-center gap-3 rounded-lg border p-3 text-sm transition-all duration-200 shadow-sm ${theme.card}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold truncate">{item.menu_item_name}</span>
          <span className="text-muted-foreground shrink-0">x{item.quantity}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="font-medium">{item.table_name}</span>
          <span>•</span>
          <span>{new Date(item.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        {item.note && (
          <p className="mt-1 text-xs font-semibold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 rounded px-2 py-1 truncate">
            📝 {item.note}
          </p>
        )}
      </div>
      {action && (
        <Button size="default" className={`shrink-0 h-9 text-sm px-4 font-semibold ${theme.btn}`} onClick={() => action(item)}>
          {item.status === "new" ? "Nhận" : "Xong"}
        </Button>
      )}
    </div>
  );

  const Column = ({ title, emoji, items: colItems, action, theme }: { title: string; emoji: string; items: KitchenItem[]; action?: (item: KitchenItem) => void; theme: { header: string; bg: string; card: string; btn: string } }) => (
    <div className={`flex-1 min-w-0 rounded-xl p-3 border-2 ${theme.bg}`}>
      <div className={`flex items-center gap-2 mb-3 px-1 pb-2 border-b-2 ${theme.header}`}>
        <span className="text-base">{emoji}</span>
        <span className="text-sm font-bold uppercase tracking-wide">{title}</span>
        <Badge className="text-[11px] h-5 px-2 ml-auto bg-background/80 text-foreground border">{colItems.length}</Badge>
      </div>
      <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
        {colItems.map(item => <ItemRow key={item.id} item={item} action={action} theme={{ card: theme.card, btn: theme.btn }} />)}
      </div>
      {colItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-6 italic">Trống</p>}
    </div>
  );

  const themes = {
    new: {
      header: "border-orange-400 dark:border-orange-600 text-orange-700 dark:text-orange-300",
      bg: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900",
      card: "bg-white dark:bg-orange-950/50 border-orange-200 dark:border-orange-800",
      btn: "bg-orange-500 hover:bg-orange-600 text-white",
    },
    preparing: {
      header: "border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300",
      bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900",
      card: "bg-white dark:bg-blue-950/50 border-blue-200 dark:border-blue-800",
      btn: "bg-blue-500 hover:bg-blue-600 text-white",
    },
    done: {
      header: "border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900",
      card: "bg-white dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800",
      btn: "",
    },
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <Column title="Món mới" emoji="🆕" items={newItems} action={(item) => updateStatus(item.id, "preparing")} theme={themes.new} />
      <Column title="Đang làm" emoji="🍳" items={preparingItems} action={(item) => updateStatus(item.id, "done")} theme={themes.preparing} />
      <Column title="Hoàn thành" emoji="✅" items={doneItems} theme={themes.done} />
    </div>
  );
}
