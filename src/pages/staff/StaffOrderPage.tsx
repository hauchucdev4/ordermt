import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Minus, Trash2, Send } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type TableRow = Database["public"]["Tables"]["tables"]["Row"];
type MenuItem = Database["public"]["Tables"]["menu_items"]["Row"];
type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];

interface OrderItemWithMenu extends OrderItem {
  menu_items?: { name: string; price: number } | null;
}

export default function StaffOrderPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<TableRow | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemWithMenu[]>([]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const audioRef = useRef<AudioContext | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const canDeleteAll = profile?.role === "manager" || profile?.role === "admin";

  const playSound = () => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 660;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  const fetchTables = useCallback(async () => {
    if (!profile?.restaurant_id) return;
    const { data } = await supabase.from("tables").select("*").eq("restaurant_id", profile.restaurant_id).order("name");
    setTables(data || []);
  }, [profile?.restaurant_id]);

  const fetchMenu = useCallback(async () => {
    if (!profile?.restaurant_id) return;
    const { data } = await supabase.from("menu_items").select("*").eq("restaurant_id", profile.restaurant_id).eq("available", true).order("category");
    setMenuItems(data || []);
  }, [profile?.restaurant_id]);

  const fetchData = useCallback(async () => {
    await Promise.all([fetchTables(), fetchMenu()]);
    setLoading(false);
  }, [fetchTables, fetchMenu]);

  const loadTableOrder = useCallback(async (table: TableRow) => {
    const { data: orders } = await supabase
      .from("orders").select("*").eq("table_id", table.id).eq("status", "open").limit(1);

    if (orders && orders.length > 0) {
      setOrderId(orders[0].id);
      const { data: items } = await supabase
        .from("order_items").select("*, menu_items(name, price)").eq("order_id", orders[0].id).order("created_at");
      setOrderItems((items as OrderItemWithMenu[]) || []);
    } else {
      setOrderId(null);
      setOrderItems([]);
    }
  }, []);

  // Setup realtime with auto-reconnect
  useEffect(() => {
    fetchData();
    if (!profile?.restaurant_id) return;

    const setupChannel = () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);

      const channel = supabase
        .channel(`staff-realtime-${profile.restaurant_id}-${Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
          playSound();
          if (selectedTable) loadTableOrder(selectedTable);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "tables", filter: `restaurant_id=eq.${profile.restaurant_id}` }, () => {
          fetchTables();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${profile.restaurant_id}` }, () => {
          if (selectedTable) loadTableOrder(selectedTable);
          fetchTables();
        })
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            setTimeout(setupChannel, 3000);
          }
        });

      channelRef.current = channel;
    };

    setupChannel();

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        setupChannel();
      }
    }, 5 * 60 * 1000); // reconnect every 5 min

    return () => {
      clearInterval(heartbeat);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [profile?.restaurant_id, selectedTable?.id]);

  // Reload order items when selecting table
  useEffect(() => {
    if (selectedTable) loadTableOrder(selectedTable);
  }, [selectedTable?.id]);

  const openTable = (table: TableRow) => {
    setSelectedTable(table);
    setCart({});
    setNotes({});
  };

  const addToCart = (menuId: string, delta: number) => {
    setCart(prev => {
      const val = (prev[menuId] || 0) + delta;
      if (val <= 0) { const { [menuId]: _, ...rest } = prev; return rest; }
      return { ...prev, [menuId]: val };
    });
  };

  const submitOrder = async () => {
    if (!selectedTable || !profile?.restaurant_id || Object.keys(cart).length === 0) return;

    let currentOrderId = orderId;
    if (!currentOrderId) {
      const { data: newOrder, error } = await supabase
        .from("orders").insert({ restaurant_id: profile.restaurant_id, table_id: selectedTable.id }).select().single();
      if (error || !newOrder) {
        toast({ title: "Lỗi", description: error?.message, variant: "destructive" });
        return;
      }
      currentOrderId = newOrder.id;
      setOrderId(currentOrderId);
      await supabase.from("tables").update({ status: "occupied" as const }).eq("id", selectedTable.id);
    }

    const items = Object.entries(cart).map(([menuId, qty]) => ({
      order_id: currentOrderId!, menu_item_id: menuId, quantity: qty, note: notes[menuId] || null,
    }));

    const { error } = await supabase.from("order_items").insert(items);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã gửi món lên bếp" });
      setCart({});
      setNotes({});
      loadTableOrder(selectedTable);
      fetchTables();
    }
  };

  const deleteItem = async (item: OrderItemWithMenu) => {
    if (item.status !== "new" && !canDeleteAll) {
      toast({ title: "Không thể xóa", description: "Chỉ quản lý/admin mới xóa được món đang làm hoặc đã xong", variant: "destructive" });
      return;
    }
    if (item.status !== "new" && !confirm(`Xóa món "${item.menu_items?.name}" (${item.status === "preparing" ? "đang làm" : "đã xong"})?`)) return;

    const { error } = await supabase.from("order_items").delete().eq("id", item.id);
    if (error) {
      toast({ title: "Lỗi xóa", description: error.message, variant: "destructive" });
    } else {
      if (selectedTable) loadTableOrder(selectedTable);
    }
  };

  const statusLabel: Record<string, { label: string; color: string }> = {
    new: { label: "Mới", color: "bg-accent text-accent-foreground" },
    preparing: { label: "Đang làm", color: "bg-orange-500/20 text-orange-700 dark:text-orange-300" },
    done: { label: "Hoàn thành", color: "bg-green-500/20 text-green-700 dark:text-green-300" },
  };

  const categories = [...new Set(menuItems.map(m => m.category))];

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-bold mb-4">Chọn bàn</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {tables.map(table => (
          <Card key={table.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => openTable(table)}>
            <CardContent className="p-4 text-center">
              <p className="font-bold text-lg">{table.name}</p>
              <Badge className={table.status === "empty" ? "bg-green-500/20 text-green-700 dark:text-green-300" : "bg-orange-500/20 text-orange-700 dark:text-orange-300"}>
                {table.status === "empty" ? "Trống" : "Có khách"}
              </Badge>
            </CardContent>
          </Card>
        ))}
        {tables.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-8">Chưa có bàn nào</p>
        )}
      </div>

      {/* Center Dialog instead of Sheet */}
      <Dialog open={!!selectedTable} onOpenChange={(open) => !open && setSelectedTable(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTable?.name} - Đặt món</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Menu */}
            {categories.map(cat => (
              <div key={cat}>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">{cat}</h3>
                <div className="space-y-2">
                  {menuItems.filter(m => m.category === cat).map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded-lg border">
                      <div className="flex items-center gap-3">
                        {item.image_url && (
                          <img src={item.image_url} alt={item.name} className="h-10 w-10 rounded object-cover" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.price.toLocaleString("vi-VN")}đ</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => addToCart(item.id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">{cart[item.id] || 0}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => addToCart(item.id, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {Object.keys(cart).length > 0 && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Ghi chú</h3>
                {Object.entries(cart).map(([menuId, qty]) => {
                  const item = menuItems.find(m => m.id === menuId);
                  return (
                    <div key={menuId} className="mb-2">
                      <p className="text-sm">{item?.name} x{qty}</p>
                      <Input
                        placeholder="Ghi chú..."
                        value={notes[menuId] || ""}
                        onChange={(e) => setNotes(prev => ({ ...prev, [menuId]: e.target.value }))}
                        className="mt-1 h-8 text-xs"
                      />
                    </div>
                  );
                })}
                <Button className="w-full mt-3" onClick={submitOrder}>
                  <Send className="mr-2 h-4 w-4" /> Đặt món
                </Button>
              </div>
            )}

            {/* Current orders */}
            {orderItems.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Order hiện tại</h3>
                {(["new", "preparing", "done"] as const).map(status => {
                  const group = orderItems.filter(i => i.status === status);
                  if (group.length === 0) return null;
                  const info = statusLabel[status];
                  return (
                    <div key={status} className="mb-3">
                      <Badge className={`${info.color} mb-2`}>{info.label}</Badge>
                      {group.map(item => (
                        <div key={item.id} className="flex items-center justify-between py-1 text-sm">
                          <div>
                            <span>{item.menu_items?.name}</span>
                            <span className="text-muted-foreground"> x{item.quantity}</span>
                            {item.note && <span className="text-xs text-muted-foreground italic ml-1">({item.note})</span>}
                          </div>
                          {(status === "new" || canDeleteAll) ? (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteItem(item)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-30 cursor-not-allowed" disabled title="Chỉ quản lý/admin mới xóa được">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
