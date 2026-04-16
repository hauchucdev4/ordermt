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
import { Loader2, Plus, Minus, Trash2, Send, CreditCard, Eye, Search, UtensilsCrossed, ClipboardList } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import ReceiptPreview, { type ReceiptData } from "@/components/restaurant/ReceiptPreview";
import { playRealtimeAlert, primeRealtimeAudio } from "@/lib/realtimeAlerts";

type TableRow = Database["public"]["Tables"]["tables"]["Row"];
type MenuItem = Database["public"]["Tables"]["menu_items"]["Row"];
type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];

interface OrderItemWithMenu extends OrderItem {
  menu_items?: { name: string; price: number } | null;
}

interface OrderStationProps {
  restaurantId: string;
  restaurantName?: string;
}

export default function OrderStation({ restaurantId, restaurantName: propRestaurantName }: OrderStationProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<TableRow | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemWithMenu[]>([]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [menuSearch, setMenuSearch] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [paying, setPaying] = useState(false);
  const [restaurantName, setRestaurantName] = useState(propRestaurantName || "");
  const [receiptPreview, setReceiptPreview] = useState<ReceiptData | null>(null);
  const [receiptPayMode, setReceiptPayMode] = useState(false);
  const [mobileTab, setMobileTab] = useState<"menu" | "order">("menu");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const previousTableSignatureRef = useRef<string | null>(null);
  const previousOrderItemsRef = useRef<Array<{ id: string; status: string }>>([]);

  const canDeleteAll = profile?.role === "manager" || profile?.role === "admin";

  const fetchTables = useCallback(async () => {
    const { data } = await supabase.from("tables").select("*").eq("restaurant_id", restaurantId).order("name");
    const nextTables = data || [];
    const nextSignature = nextTables.map(table => `${table.id}:${table.status}`).join("|");

    if (previousTableSignatureRef.current !== null && previousTableSignatureRef.current !== nextSignature) {
      playRealtimeAlert("update");
    }

    previousTableSignatureRef.current = nextSignature;
    setTables(nextTables);
  }, [restaurantId]);

  const fetchMenu = useCallback(async () => {
    const { data } = await supabase.from("menu_items").select("*").eq("restaurant_id", restaurantId).eq("available", true).order("category");
    setMenuItems(data || []);
  }, [restaurantId]);

  const fetchRestaurantName = useCallback(async () => {
    if (propRestaurantName) return;
    const { data } = await supabase.from("restaurants").select("name").eq("id", restaurantId).single();
    if (data) setRestaurantName(data.name);
  }, [restaurantId, propRestaurantName]);

  const fetchData = useCallback(async () => {
    await Promise.all([fetchTables(), fetchMenu(), fetchRestaurantName()]);
    setLoading(false);
  }, [fetchTables, fetchMenu, fetchRestaurantName]);

  const loadTableOrder = useCallback(async (table: TableRow) => {
    const { data: orders } = await supabase
      .from("orders").select("*").eq("table_id", table.id).eq("status", "open").limit(1);

    if (orders && orders.length > 0) {
      setOrderId(orders[0].id);
      const { data: items } = await supabase
        .from("order_items").select("*, menu_items(name, price)").eq("order_id", orders[0].id).order("created_at");

      const nextItems = (items as OrderItemWithMenu[]) || [];
      const previousItems = previousOrderItemsRef.current;
      const nextSnapshot = nextItems.map(item => ({ id: item.id, status: item.status }));

      if (previousItems.length > 0) {
        const previousMap = new Map(previousItems.map(item => [item.id, item.status]));
        const hasNewItem = nextSnapshot.some(item => !previousMap.has(item.id));
        const hasStatusChange = nextSnapshot.some(item => previousMap.has(item.id) && previousMap.get(item.id) !== item.status);

        if (hasNewItem) playRealtimeAlert("new");
        else if (hasStatusChange) playRealtimeAlert("update");
      }

      previousOrderItemsRef.current = nextSnapshot;
      setOrderItems(nextItems);
    } else {
      setOrderId(null);
      previousOrderItemsRef.current = [];
      setOrderItems([]);
    }
  }, []);

  useEffect(() => {
    const detachAudioPrime = primeRealtimeAudio();
    fetchData();

    const refreshView = () => {
      fetchTables();
      if (selectedTable) loadTableOrder(selectedTable);
    };

    const setupChannel = () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);

      const channel = supabase
        .channel(`order-station-${restaurantId}-${Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
          refreshView();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "tables", filter: `restaurant_id=eq.${restaurantId}` }, () => {
          fetchTables();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, () => {
          refreshView();
        })
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setTimeout(setupChannel, 3000);
        });

      channelRef.current = channel;
    };

    setupChannel();
    const heartbeat = setInterval(() => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); setupChannel(); }
    }, 5 * 60 * 1000);
    const poller = setInterval(refreshView, 2500);

    return () => {
      detachAudioPrime();
      clearInterval(heartbeat);
      clearInterval(poller);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [restaurantId, selectedTable, fetchData, fetchTables, loadTableOrder]);

  useEffect(() => {
    if (selectedTable) loadTableOrder(selectedTable);
  }, [selectedTable?.id]);

  const openTable = (table: TableRow) => {
    previousOrderItemsRef.current = [];
    setSelectedTable(table);
    setCart({});
    setNotes({});
    setMenuSearch("");
  };

  const addToCart = (menuId: string, delta: number) => {
    setCart(prev => {
      const val = (prev[menuId] || 0) + delta;
      if (val <= 0) { const { [menuId]: _, ...rest } = prev; return rest; }
      return { ...prev, [menuId]: val };
    });
  };

  const submitOrder = async () => {
    if (!selectedTable || Object.keys(cart).length === 0) return;

    let currentOrderId = orderId;
    if (!currentOrderId) {
      const { data: newOrder, error } = await supabase
        .from("orders").insert({ restaurant_id: restaurantId, table_id: selectedTable.id }).select().single();
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

  const orderTotal = orderItems.reduce((sum, i) => sum + (i.quantity * (i.menu_items?.price || 0)), 0);

  const handlePay = async () => {
    if (!orderId || !selectedTable) return;
    setPaying(true);
    await supabase.from("orders").update({ status: "paid" as const, total: orderTotal, paid_at: new Date().toISOString() }).eq("id", orderId);
    await supabase.from("tables").update({ status: "empty" as const }).eq("id", selectedTable.id);
    toast({ title: "Thanh toán thành công", description: `${selectedTable.name} - ${orderTotal.toLocaleString("vi-VN")}₫` });
    setPaying(false);
    setReceiptPreview(null);
    setReceiptPayMode(false);
    setSelectedTable(null);
    fetchTables();
  };

  const buildReceiptData = (): ReceiptData | null => {
    if (!selectedTable || orderItems.length === 0) return null;
    return {
      restaurantName: restaurantName || "Nhà hàng",
      tableName: selectedTable.name,
      orderId: orderId || undefined,
      items: orderItems.map(i => ({
        name: i.menu_items?.name || "?",
        quantity: i.quantity,
        price: Number(i.menu_items?.price || 0),
      })),
      total: orderTotal,
    };
  };

  const showBillPreview = (payMode: boolean) => {
    const data = buildReceiptData();
    if (!data) return;
    setReceiptPayMode(payMode);
    setReceiptPreview(data);
  };

  const statusLabel: Record<string, { label: string; color: string }> = {
    new: { label: "Mới", color: "bg-accent text-accent-foreground" },
    preparing: { label: "Đang làm", color: "bg-orange-500/20 text-orange-700 dark:text-orange-300" },
    done: { label: "Hoàn thành", color: "bg-green-500/20 text-green-700 dark:text-green-300" },
  };

  const removeAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
  const filteredMenu = menuSearch.trim()
    ? menuItems.filter(m => removeAccents(m.name.toLowerCase()).includes(removeAccents(menuSearch.trim().toLowerCase())))
    : menuItems;
  const categories = [...new Set(filteredMenu.map(m => m.category))];

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-2">
        {tables.map(table => (
          <Card key={table.id} className="cursor-pointer hover:shadow-md transition-all aspect-square" onClick={() => openTable(table)}>
            <CardContent className="p-2 h-full flex flex-col items-center justify-center gap-1">
              <p className="font-bold text-lg leading-none">{table.name}</p>
              <Badge className={`text-[10px] px-1.5 py-0 ${table.status === "empty" ? "bg-green-500/20 text-green-700 dark:text-green-300" : "bg-orange-500/20 text-orange-700 dark:text-orange-300"}`}>
                {table.status === "empty" ? "Trống" : "Có khách"}
              </Badge>
            </CardContent>
          </Card>
        ))}
        {tables.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-8">Chưa có bàn nào</p>
        )}
      </div>

      <Dialog open={!!selectedTable} onOpenChange={(open) => !open && setSelectedTable(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-4 pt-4 pb-0 md:px-6 md:pt-6 md:pb-2">
            <DialogTitle className="text-base md:text-lg">{selectedTable?.name} - Đặt món</DialogTitle>
          </DialogHeader>

          {/* Mobile tabs */}
          <div className="flex md:hidden border-b">
            <button
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${mobileTab === "menu" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
              onClick={() => setMobileTab("menu")}
            >
              <UtensilsCrossed className="h-4 w-4" /> Thực đơn
              {Object.keys(cart).length > 0 && (
                <Badge variant="secondary" className="h-5 min-w-[20px] px-1 text-[10px]">{Object.values(cart).reduce((a, b) => a + b, 0)}</Badge>
              )}
            </button>
            <button
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${mobileTab === "order" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
              onClick={() => setMobileTab("order")}
            >
              <ClipboardList className="h-4 w-4" /> Order
              {orderItems.length > 0 && (
                <Badge variant="secondary" className="h-5 min-w-[20px] px-1 text-[10px]">{orderItems.length}</Badge>
              )}
            </button>
          </div>

          <div
            className="overflow-hidden md:overflow-visible"
            style={{ maxHeight: "calc(90vh - 120px)" }}
          >
            {/* Mobile: sliding panels */}
            <div
              className="flex md:hidden transition-transform duration-300 ease-in-out"
              style={{ width: "200%", transform: mobileTab === "order" ? "translateX(-50%)" : "translateX(0)" }}
              onTouchStart={(e) => { (e.currentTarget as any)._touchX = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                const startX = (e.currentTarget as any)._touchX;
                if (startX == null) return;
                const diff = e.changedTouches[0].clientX - startX;
                if (Math.abs(diff) > 50) {
                  setMobileTab(diff > 0 ? "menu" : "order");
                }
              }}
            >
              {/* Panel 1: Menu */}
              <div className="w-1/2 flex flex-col overflow-hidden" style={{ maxHeight: "calc(90vh - 120px)" }}>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Tìm món..." value={menuSearch} onChange={e => setMenuSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                  </div>
                  {categories.length === 0 && menuSearch && (
                    <p className="text-sm text-muted-foreground py-4 text-center">Không tìm thấy món "{menuSearch}"</p>
                  )}
                  {categories.map(cat => (
                    <div key={cat}>
                      <h4 className="font-medium text-xs text-muted-foreground mb-1">{cat}</h4>
                      <div className="space-y-1">
                        {filteredMenu.filter(m => m.category === cat).map(item => (
                          <div key={item.id} className="flex items-center justify-between p-1.5 rounded-lg border">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {item.image_url && <img src={item.image_url} alt={item.name} className="h-8 w-8 rounded object-cover shrink-0" />}
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{item.price.toLocaleString("vi-VN")}đ</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => addToCart(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                              <span className={`w-5 text-center text-sm font-bold ${cart[item.id] ? "text-primary" : "text-muted-foreground"}`}>{cart[item.id] || 0}</span>
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => addToCart(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {Object.keys(cart).length > 0 && (
                  <div className="border-t bg-muted/50 p-3 space-y-1.5 shrink-0 max-h-[35%] overflow-y-auto">
                    <h4 className="font-semibold text-xs">Ghi chú ({Object.values(cart).reduce((a, b) => a + b, 0)} món)</h4>
                    {Object.entries(cart).map(([menuId, qty]) => {
                      const item = menuItems.find(m => m.id === menuId);
                      return (
                        <div key={menuId} className="flex items-center gap-1.5">
                          <span className="text-xs font-medium shrink-0 truncate max-w-[120px]">{item?.name}</span>
                          <Badge variant="secondary" className="text-[10px] px-1 shrink-0">x{qty}</Badge>
                          <Input placeholder="Ghi chú..." value={notes[menuId] || ""} onChange={(e) => setNotes(prev => ({ ...prev, [menuId]: e.target.value }))} className="h-6 text-xs flex-1" />
                        </div>
                      );
                    })}
                    <Button className="w-full h-8 text-sm" onClick={submitOrder}><Send className="mr-1.5 h-3.5 w-3.5" /> Đặt món ({Object.values(cart).reduce((a, b) => a + b, 0)})</Button>
                  </div>
                )}
              </div>

              {/* Panel 2: Order */}
              <div className="w-1/2 flex flex-col" style={{ maxHeight: "calc(90vh - 120px)" }}>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {orderItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Chưa có món nào</p>
                  ) : (
                    <>
                      {(["new", "preparing", "done"] as const).map(status => {
                        const group = orderItems.filter(i => i.status === status);
                        if (group.length === 0) return null;
                        const info = statusLabel[status];
                        return (
                          <div key={status} className="mb-1.5">
                            <Badge className={`${info.color} mb-1 text-[10px]`}>{info.label}</Badge>
                            {group.map(item => (
                              <div key={item.id} className="flex items-center justify-between py-0.5 text-sm">
                                <div className="flex-1 min-w-0">
                                  <span>{item.menu_items?.name}</span>
                                  <span className="text-muted-foreground"> x{item.quantity}</span>
                                  <span className="text-muted-foreground ml-1.5">{((item.menu_items?.price || 0) * item.quantity).toLocaleString("vi-VN")}đ</span>
                                  {item.note && <span className="text-xs text-muted-foreground italic ml-1">({item.note})</span>}
                                </div>
                                {(status === "new" || canDeleteAll) ? (
                                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => deleteItem(item)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                ) : (
                                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-30 cursor-not-allowed" disabled><Trash2 className="h-3 w-3" /></Button>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
                {orderItems.length > 0 && (
                  <div className="shrink-0 border-t bg-background p-3 space-y-2">
                    <div className="flex justify-between font-bold text-base">
                      <span>Tổng cộng</span>
                      <span className="text-primary">{orderTotal.toLocaleString("vi-VN")}₫</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 h-9" onClick={() => showBillPreview(false)}>
                        <Eye className="mr-1.5 h-4 w-4" /> Xem bill
                      </Button>
                      <Button className="flex-1 h-9" onClick={() => showBillPreview(true)}>
                        <CreditCard className="mr-1.5 h-4 w-4" /> Thanh toán
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Desktop: side-by-side */}
            <div className="hidden md:flex md:divide-x divide-border" style={{ maxHeight: "calc(90vh - 120px)" }}>
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Tìm món..." value={menuSearch} onChange={e => setMenuSearch(e.target.value)} className="pl-8 h-9 text-sm" />
                  </div>
                  {categories.length === 0 && menuSearch && (
                    <p className="text-sm text-muted-foreground py-4 text-center">Không tìm thấy món "{menuSearch}"</p>
                  )}
                  {categories.map(cat => (
                    <div key={cat}>
                      <h4 className="font-medium text-xs text-muted-foreground mb-1">{cat}</h4>
                      <div className="space-y-1.5">
                        {filteredMenu.filter(m => m.category === cat).map(item => (
                          <div key={item.id} className="flex items-center justify-between p-2 rounded-lg border">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {item.image_url && <img src={item.image_url} alt={item.name} className="h-9 w-9 rounded object-cover shrink-0" />}
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{item.price.toLocaleString("vi-VN")}đ</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => addToCart(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                              <span className={`w-6 text-center text-sm font-bold ${cart[item.id] ? "text-primary" : "text-muted-foreground"}`}>{cart[item.id] || 0}</span>
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => addToCart(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {Object.keys(cart).length > 0 && (
                  <div className="border-t bg-muted/50 p-4 space-y-2 shrink-0 max-h-[35%] overflow-y-auto">
                    <h4 className="font-semibold text-sm">Ghi chú ({Object.values(cart).reduce((a, b) => a + b, 0)} món)</h4>
                    {Object.entries(cart).map(([menuId, qty]) => {
                      const item = menuItems.find(m => m.id === menuId);
                      return (
                        <div key={menuId} className="flex items-center gap-2">
                          <span className="text-sm font-medium shrink-0">{item?.name} <Badge variant="secondary" className="ml-1">x{qty}</Badge></span>
                          <Input placeholder="Ghi chú..." value={notes[menuId] || ""} onChange={(e) => setNotes(prev => ({ ...prev, [menuId]: e.target.value }))} className="h-7 text-xs flex-1" />
                        </div>
                      );
                    })}
                    <Button className="w-full" onClick={submitOrder}><Send className="mr-2 h-4 w-4" /> Đặt món ({Object.values(cart).reduce((a, b) => a + b, 0)})</Button>
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-6 pb-2">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Order hiện tại</h3>
                </div>
                <div className="flex-1 overflow-y-auto px-6 space-y-4">
                  {orderItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Chưa có món nào</p>
                  ) : (
                    <>
                      {(["new", "preparing", "done"] as const).map(status => {
                        const group = orderItems.filter(i => i.status === status);
                        if (group.length === 0) return null;
                        const info = statusLabel[status];
                        return (
                          <div key={status} className="mb-2">
                            <Badge className={`${info.color} mb-1`}>{info.label}</Badge>
                            {group.map(item => (
                              <div key={item.id} className="flex items-center justify-between py-1 text-sm">
                                <div className="flex-1 min-w-0">
                                  <span>{item.menu_items?.name}</span>
                                  <span className="text-muted-foreground"> x{item.quantity}</span>
                                  <span className="text-muted-foreground ml-2">{((item.menu_items?.price || 0) * item.quantity).toLocaleString("vi-VN")}đ</span>
                                  {item.note && <span className="text-xs text-muted-foreground italic ml-1">({item.note})</span>}
                                </div>
                                {(status === "new" || canDeleteAll) ? (
                                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => deleteItem(item)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                ) : (
                                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-30 cursor-not-allowed" disabled><Trash2 className="h-3 w-3" /></Button>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
                {orderItems.length > 0 && (
                  <div className="shrink-0 border-t bg-background p-6 pt-4 space-y-3">
                    <div className="flex justify-between font-bold text-lg">
                      <span>Tổng cộng</span>
                      <span className="text-primary">{orderTotal.toLocaleString("vi-VN")}₫</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => showBillPreview(false)}>
                        <Eye className="mr-2 h-4 w-4" /> Xem bill
                      </Button>
                      <Button className="flex-1" onClick={() => showBillPreview(true)}>
                        <CreditCard className="mr-2 h-4 w-4" /> Thanh toán
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ReceiptPreview
        data={receiptPreview}
        open={!!receiptPreview}
        onClose={() => { setReceiptPreview(null); setReceiptPayMode(false); }}
        onPay={receiptPayMode ? handlePay : undefined}
        paying={paying}
      />
    </>
  );
}
