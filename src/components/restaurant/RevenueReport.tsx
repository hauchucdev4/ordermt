import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, ShoppingCart, LayoutGrid } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type TimeFilter = "today" | "week" | "month" | "year";

export default function RevenueReport({ restaurantId }: { restaurantId: string }) {
  const [filter, setFilter] = useState<TimeFilter>("today");
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [chartData, setChartData] = useState<{ label: string; revenue: number }[]>([]);

  const getDateRange = (f: TimeFilter) => {
    const now = new Date();
    const start = new Date();
    if (f === "today") { start.setHours(0, 0, 0, 0); }
    else if (f === "week") { start.setDate(now.getDate() - 7); }
    else if (f === "month") { start.setMonth(now.getMonth() - 1); }
    else { start.setFullYear(now.getFullYear() - 1); }
    return { start: start.toISOString(), end: now.toISOString() };
  };

  const fetchReport = async () => {
    setLoading(true);
    const { start, end } = getDateRange(filter);

    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("status", "paid")
      .gte("paid_at", start)
      .lte("paid_at", end);

    const paidOrders = orders || [];
    setTotalRevenue(paidOrders.reduce((sum, o) => sum + Number(o.total), 0));
    setTotalOrders(paidOrders.length);

    // Group by date for chart
    const grouped: Record<string, number> = {};
    paidOrders.forEach((o) => {
      const d = new Date(o.paid_at!).toLocaleDateString("vi-VN");
      grouped[d] = (grouped[d] || 0) + Number(o.total);
    });
    setChartData(Object.entries(grouped).map(([label, revenue]) => ({ label, revenue })));
    setLoading(false);
  };

  useEffect(() => { fetchReport(); }, [restaurantId, filter]);

  const filters: { value: TimeFilter; label: string }[] = [
    { value: "today", label: "Hôm nay" },
    { value: "week", label: "Tuần này" },
    { value: "month", label: "Tháng này" },
    { value: "year", label: "Năm nay" },
  ];

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <Button key={f.value} variant={filter === f.value ? "default" : "outline"} size="sm" onClick={() => setFilter(f.value)}>
            {f.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tổng doanh thu</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalRevenue.toLocaleString("vi-VN")}₫</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tổng số order</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalOrders}</p>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Biểu đồ doanh thu</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(v: number) => `${v.toLocaleString("vi-VN")}₫`} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
