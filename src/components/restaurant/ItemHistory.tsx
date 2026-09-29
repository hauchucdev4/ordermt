import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, History } from "lucide-react";

interface Row {
  id: string;
  quantity: number;
  note: string | null;
  created_at: string;
  done_at: string | null;
  created_by_name: string | null;
  menu_items: { name: string } | null;
  orders: { status: string; tables: { name: string } | null } | null;
}

const toDateInput = (d: Date) => {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
};
const fmt = (s: string | null) =>
  s ? new Date(s).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }) : "-";

export default function ItemHistory({ restaurantId }: { restaurantId: string }) {
  const [date, setDate] = useState(toDateInput(new Date()));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(start.getTime() + 86400000);
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);
    const upper = end < cutoff ? end : cutoff;
    const { data } = await supabase
      .from("order_items")
      .select("id, quantity, note, created_at, done_at, created_by_name, menu_items(name), orders!inner(restaurant_id, status, tables:table_id(name))")
      .eq("orders.restaurant_id", restaurantId)
      .eq("status", "done")
      .gte("done_at", start.toISOString())
      .lte("done_at", upper.toISOString())
      .order("done_at", { ascending: false });
    setRows((data as any) || []);
    setLoading(false);
  }, [restaurantId, date]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="pix-icon"><History className="h-5 w-5" /></span>
          <div>
            <h2 className="text-lg font-bold">Lịch sử món</h2>
            <p className="text-xs text-muted-foreground">Món hoàn thành quá 10 phút sẽ tự chuyển vào đây</p>
          </div>
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Chưa có món nào trong ngày này</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.menu_items?.name}</span>
                <Badge variant="secondary">x{r.quantity}</Badge>
                <span className="text-sm text-muted-foreground">{r.orders?.tables?.name}</span>
                {r.orders?.status === "paid" && <Badge variant="outline">Đã thanh toán</Badge>}
              </div>
              <div className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                <span>Đặt lúc: {fmt(r.created_at)}</span>
                <span className="font-semibold text-primary">Hoàn thành: {fmt(r.done_at)}</span>
                <span>NV: {r.created_by_name || "-"}</span>
              </div>
              {r.note && <p className="mt-1 text-xs font-semibold">📝 {r.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
