import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, Receipt, CreditCard, Eye } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import ReceiptPreview, { type ReceiptData } from "./ReceiptPreview";

type TableRow = Database["public"]["Tables"]["tables"]["Row"];

interface BillItem { name: string; quantity: number; price: number; }
interface TableBill { table: TableRow; orderId: string; items: BillItem[]; total: number; createdAt: string; }

export default function BillPayment({ restaurantId, restaurantName }: { restaurantId: string; restaurantName?: string }) {
  const { toast } = useToast();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<TableBill | null>(null);
  const [paying, setPaying] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<ReceiptData | null>(null);
  const [receiptPayMode, setReceiptPayMode] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchOccupiedTables = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tables").select("*").eq("restaurant_id", restaurantId).eq("status", "occupied").order("name");
    setTables(data || []);
    setLoading(false);
  }, [restaurantId]);

  // Realtime with auto-reconnect
  useEffect(() => {
    fetchOccupiedTables();

    const setupChannel = () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      const channel = supabase
        .channel(`billing-${restaurantId}-${Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "tables", filter: `restaurant_id=eq.${restaurantId}` }, () => fetchOccupiedTables())
        .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` }, () => fetchOccupiedTables())
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

  const viewBill = async (table: TableRow) => {
    const { data: orders } = await supabase
      .from("orders").select("*").eq("table_id", table.id).eq("status", "open").limit(1);

    if (!orders || orders.length === 0) {
      toast({ title: "Không có order", description: "Bàn này chưa có order nào", variant: "destructive" });
      return;
    }

    const order = orders[0];
    const { data: orderItems } = await supabase
      .from("order_items").select("*, menu_items(name, price)").eq("order_id", order.id);

    const items: BillItem[] = (orderItems || []).map((oi: any) => ({
      name: oi.menu_items?.name || "?", quantity: oi.quantity, price: Number(oi.menu_items?.price || 0),
    }));
    const total = items.reduce((s, i) => s + i.quantity * i.price, 0);

    setSelectedBill({ table, orderId: order.id, items, total, createdAt: order.created_at });
  };

  const handlePay = async () => {
    if (!selectedBill) return;
    setPaying(true);

    await supabase.from("orders")
      .update({ status: "paid" as const, total: selectedBill.total, paid_at: new Date().toISOString() })
      .eq("id", selectedBill.orderId);

    await supabase.from("tables")
      .update({ status: "empty" as const })
      .eq("id", selectedBill.table.id);

    toast({ title: "Thanh toán thành công", description: `${selectedBill.table.name} - ${selectedBill.total.toLocaleString("vi-VN")}₫` });
    setPaying(false);
    setSelectedBill(null);
    setReceiptPreview(null);
    fetchOccupiedTables();
  };

  const showBillPreview = (payMode: boolean) => {
    if (!selectedBill) return;
    setReceiptPayMode(payMode);
    setReceiptPreview({
      restaurantName: restaurantName || "Nhà hàng",
      tableName: selectedBill.table.name,
      orderId: selectedBill.orderId,
      items: selectedBill.items,
      total: selectedBill.total,
    });
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {tables.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Không có bàn nào cần thanh toán</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {tables.map(t => (
            <Card key={t.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => viewBill(t)}>
              <CardContent className="p-4 text-center">
                <p className="font-bold text-lg">{t.name}</p>
                <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-300 mt-1">Có khách</Badge>
                <p className="text-xs text-muted-foreground mt-2">Nhấn để thanh toán</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedBill} onOpenChange={open => !open && setSelectedBill(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          {/* Header */}
          <div className="bg-primary/5 border-b px-6 py-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Receipt className="h-5 w-5 text-primary" /> Hóa đơn - {selectedBill?.table.name}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {restaurantName && <span className="font-medium">{restaurantName} • </span>}
                {selectedBill && new Date(selectedBill.createdAt).toLocaleString("vi-VN")}
              </p>
            </DialogHeader>
          </div>

          {selectedBill && (
            <div className="px-6 py-4 space-y-4">
              {/* Items table */}
              {selectedBill.items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Chưa có món nào</p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-muted-foreground">
                        <th className="text-left py-2 px-3 font-medium">Món</th>
                        <th className="text-center py-2 px-3 font-medium w-12">SL</th>
                        <th className="text-right py-2 px-3 font-medium w-24">Đơn giá</th>
                        <th className="text-right py-2 px-3 font-medium w-28">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBill.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="py-2 px-3">{item.name}</td>
                          <td className="py-2 px-3 text-center">{item.quantity}</td>
                          <td className="py-2 px-3 text-right text-muted-foreground">{item.price.toLocaleString("vi-VN")}₫</td>
                          <td className="py-2 px-3 text-right font-medium">{(item.quantity * item.price).toLocaleString("vi-VN")}₫</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Total */}
              <div className="flex justify-between items-center bg-primary/5 rounded-lg p-4">
                <span className="font-semibold text-lg">Tổng cộng</span>
                <span className="text-primary font-bold text-xl">{selectedBill.total.toLocaleString("vi-VN")}₫</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="border-t px-6 py-4 flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={previewBill} disabled={!selectedBill?.items.length}>
              <Eye className="mr-2 h-4 w-4" /> Xem hóa đơn
            </Button>
            <Button className="flex-1" onClick={handlePay} disabled={paying || !selectedBill?.items.length}>
              {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CreditCard className="mr-2 h-4 w-4" /> Xác nhận thanh toán
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ReceiptPreview
        data={receiptPreview}
        open={!!receiptPreview}
        onClose={() => setReceiptPreview(null)}
      />
    </div>
  );
}
