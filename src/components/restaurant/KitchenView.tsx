import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Undo2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { playRealtimeAlert, primeRealtimeAudio } from "@/lib/realtimeAlerts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [revertTarget, setRevertTarget] = useState<{ item: KitchenItem; to: "new" | "preparing" } | null>(null);
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

  const updateStatus = async (itemId: string, newStatus: "new" | "preparing" | "done") => {
    recentLocalUpdates.current.add(itemId);
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: newStatus } : i));
    await supabase.from("order_items").update({ status: newStatus }).eq("id", itemId);
    setTimeout(() => recentLocalUpdates.current.delete(itemId), 3000);
  };

  const newItems = items.filter(i => i.status === "new");
  const preparingItems = items.filter(i => i.status === "preparing");
  const doneItems = items.filter(i => i.status === "done");

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  const ItemRow = ({ item, action, theme }: { item: KitchenItem; action?: (item: KitchenItem) => void; theme: { card: string; btn: string; pill: string } }) => (
    <article className={`kitchen-item ${theme.card}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold truncate text-foreground">{item.menu_item_name}</span>
              <Badge className={`kitchen-pill ${theme.pill}`}>x{item.quantity}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">{item.table_name}</span>
              <span>•</span>
              <span>{new Date(item.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
              {item.created_by_name && (
                <>
                  <span>•</span>
                  <span className="font-medium text-foreground/80">NV: {item.created_by_name}</span>
                </>
              )}
            </div>
          </div>
        </div>
        {item.note && (
          <div className="kitchen-note">
            <span className="text-sm leading-none">📝</span>
            <p className="min-w-0 break-words text-xs font-semibold leading-5">{item.note}</p>
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {(item.status === "preparing" || item.status === "done") && (
          <Button
            size="icon"
            variant="outline"
            className="h-10 w-10"
            title={item.status === "preparing" ? "Trả về Món mới" : "Trả về Đang làm"}
            onClick={() => setRevertTarget({ item, to: item.status === "preparing" ? "new" : "preparing" })}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
        )}
        {action && (
          <Button size="default" className={`kitchen-action ${theme.btn}`} onClick={() => action(item)}>
            {item.status === "new" ? "Nhận" : "Xong"}
          </Button>
        )}
      </div>
    </article>
  );

  const Column = ({ title, emoji, items: colItems, action, theme }: { title: string; emoji: string; items: KitchenItem[]; action?: (item: KitchenItem) => void; theme: { column: string; header: string; card: string; btn: string; pill: string } }) => (
    <section className={`kitchen-column ${theme.column}`}>
      <div className={`kitchen-column-header ${theme.header}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">{emoji}</span>
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-[0.18em]">{title}</p>
            <p className="text-xs text-muted-foreground">{colItems.length === 0 ? "Chưa có món" : `${colItems.length} món đang chờ xử lý`}</p>
          </div>
        </div>
        <Badge className={`kitchen-count ${theme.pill}`}>{colItems.length}</Badge>
      </div>
      <div className="space-y-3 max-h-[calc(100vh-340px)] overflow-y-auto pr-1">
        {colItems.map(item => <ItemRow key={item.id} item={item} action={action} theme={{ card: theme.card, btn: theme.btn, pill: theme.pill }} />)}
      </div>
      {colItems.length === 0 && <p className="kitchen-empty">Trống</p>}
    </section>
  );

  const themes = {
    new: {
      column: "kitchen-column--new",
      header: "kitchen-column-header--new",
      card: "kitchen-item--new",
      btn: "kitchen-action--new",
      pill: "kitchen-pill--new",
    },
    preparing: {
      column: "kitchen-column--preparing",
      header: "kitchen-column-header--preparing",
      card: "kitchen-item--preparing",
      btn: "kitchen-action--preparing",
      pill: "kitchen-pill--preparing",
    },
    done: {
      column: "kitchen-column--done",
      header: "kitchen-column-header--done",
      card: "kitchen-item--done",
      btn: "",
      pill: "kitchen-pill--done",
    },
  };

  return (
    <div className="kitchen-shell">
      <div className="kitchen-hero">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Điều phối bếp realtime
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Bảng bếp rõ ràng, ưu tiên món mới trước</h2>
            <p className="text-sm text-muted-foreground md:text-base">Mỗi cột là một giai đoạn xử lý, ghi chú được làm nổi bật để bếp không bỏ sót.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="kitchen-summary kitchen-summary--new">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Món mới</span>
            <strong className="text-3xl font-bold">{newItems.length}</strong>
            <p className="text-xs text-muted-foreground">Cần bếp xác nhận ngay</p>
          </div>
          <div className="kitchen-summary kitchen-summary--preparing">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Đang làm</span>
            <strong className="text-3xl font-bold">{preparingItems.length}</strong>
            <p className="text-xs text-muted-foreground">Theo dõi tiến độ hiện tại</p>
          </div>
          <div className="kitchen-summary kitchen-summary--done">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Hoàn thành</span>
            <strong className="text-3xl font-bold">{doneItems.length}</strong>
            <p className="text-xs text-muted-foreground">Sẵn sàng phục vụ ra bàn</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Column title="Món mới" emoji="🆕" items={newItems} action={(item) => updateStatus(item.id, "preparing")} theme={themes.new} />
        <Column title="Đang làm" emoji="🍳" items={preparingItems} action={(item) => updateStatus(item.id, "done")} theme={themes.preparing} />
        <Column title="Hoàn thành" emoji="✅" items={doneItems} theme={themes.done} />
      </div>

      <AlertDialog open={!!revertTarget} onOpenChange={(open) => !open && setRevertTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận chuyển trạng thái</AlertDialogTitle>
            <AlertDialogDescription asChild>
              {revertTarget ? (
                <div>
                  Bạn có chắc muốn chuyển món <strong>{revertTarget.item.menu_item_name}</strong> ({revertTarget.item.table_name}) từ{" "}
                  <strong>{revertTarget.item.status === "preparing" ? "Đang làm" : "Hoàn thành"}</strong> về{" "}
                  <strong>{revertTarget.to === "new" ? "Món mới" : "Đang làm"}</strong>?
                </div>
              ) : <div />}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (revertTarget) updateStatus(revertTarget.item.id, revertTarget.to);
                setRevertTarget(null);
              }}
            >
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
