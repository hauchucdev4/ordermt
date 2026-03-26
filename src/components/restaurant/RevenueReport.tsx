import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, DollarSign, ShoppingCart, LayoutGrid, FileSpreadsheet, FileText, Receipt } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type TimeFilter = "today" | "week" | "month" | "year" | "custom";

interface TableDetail {
  tableName: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  orderId: string;
  paidAt: string;
}

export default function RevenueReport({ restaurantId }: { restaurantId: string }) {
  const [filter, setFilter] = useState<TimeFilter>("today");
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalTables, setTotalTables] = useState(0);
  const [chartData, setChartData] = useState<{ label: string; revenue: number }[]>([]);
  const [tableDetails, setTableDetails] = useState<TableDetail[]>([]);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedBill, setSelectedBill] = useState<TableDetail | null>(null);
  const [restaurantName, setRestaurantName] = useState("");

  const getDateRange = (f: TimeFilter) => {
    const now = new Date();
    const start = new Date();
    if (f === "today") { start.setHours(0, 0, 0, 0); }
    else if (f === "week") { start.setDate(now.getDate() - 7); }
    else if (f === "month") { start.setMonth(now.getMonth() - 1); }
    else if (f === "year") { start.setFullYear(now.getFullYear() - 1); }
    else if (f === "custom" && customStart && customEnd) {
      return { start: new Date(customStart).toISOString(), end: new Date(customEnd + "T23:59:59").toISOString() };
    }
    return { start: start.toISOString(), end: now.toISOString() };
  };

  const fetchReport = async () => {
    setLoading(true);
    const { start, end } = getDateRange(filter);

    // Get restaurant name
    const { data: rest } = await supabase.from("restaurants").select("name").eq("id", restaurantId).single();
    if (rest) setRestaurantName(rest.name);

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
    setTotalTables(new Set(paidOrders.map(o => o.table_id)).size);

    // Chart data
    const grouped: Record<string, number> = {};
    paidOrders.forEach((o) => {
      const d = new Date(o.paid_at!).toLocaleDateString("vi-VN");
      grouped[d] = (grouped[d] || 0) + Number(o.total);
    });
    setChartData(Object.entries(grouped).map(([label, revenue]) => ({ label, revenue })));

    // Table details
    if (paidOrders.length > 0) {
      const tableIds = [...new Set(paidOrders.map(o => o.table_id))];
      const { data: tablesData } = await supabase.from("tables").select("id, name").in("id", tableIds);
      const tableMap = new Map(tablesData?.map(t => [t.id, t.name]) || []);

      const orderIds = paidOrders.map(o => o.id);
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("order_id, quantity, menu_item_id")
        .in("order_id", orderIds);

      const menuIds = [...new Set(orderItems?.map(oi => oi.menu_item_id) || [])];
      const { data: menuItems } = menuIds.length > 0
        ? await supabase.from("menu_items").select("id, name, price").in("id", menuIds)
        : { data: [] };
      const menuMap = new Map<string, { name: string; price: number }>(
        menuItems?.map(m => [m.id, { name: m.name, price: Number(m.price) }] as [string, { name: string; price: number }]) || []
      );

      const details: TableDetail[] = paidOrders.map(o => {
        const items = (orderItems || [])
          .filter(oi => oi.order_id === o.id)
          .map(oi => {
            const menu = menuMap.get(oi.menu_item_id);
            return { name: menu?.name || "?", quantity: oi.quantity, price: menu?.price || 0 };
          });
        return {
          tableName: tableMap.get(o.table_id) || "Bàn ?",
          items,
          total: Number(o.total),
          orderId: o.id,
          paidAt: o.paid_at || o.created_at,
        };
      });
      setTableDetails(details);
    } else {
      setTableDetails([]);
    }

    setLoading(false);
  };

  useEffect(() => { fetchReport(); }, [restaurantId, filter]);

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ["Báo cáo doanh thu", restaurantName],
      ["Thời gian", filter === "custom" ? `${customStart} - ${customEnd}` : filter],
      ["Tổng doanh thu", totalRevenue],
      ["Tổng số order", totalOrders],
      ["Số bàn phục vụ", totalTables],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, "Tổng quan");

    // Detail sheet
    const detailRows: any[][] = [["Bàn", "Món", "SL", "Đơn giá", "Thành tiền", "Tổng bill", "Ngày thanh toán"]];
    tableDetails.forEach(td => {
      td.items.forEach((item, i) => {
        detailRows.push([
          i === 0 ? td.tableName : "",
          item.name,
          item.quantity,
          item.price,
          item.quantity * item.price,
          i === 0 ? td.total : "",
          i === 0 ? new Date(td.paidAt).toLocaleString("vi-VN") : "",
        ]);
      });
    });
    const ws2 = XLSX.utils.aoa_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(wb, ws2, "Chi tiết");

    XLSX.writeFile(wb, `doanh-thu-${restaurantName}-${Date.now()}.xlsx`);
  };

  const exportPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Bao cao doanh thu - ${restaurantName}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Tong doanh thu: ${totalRevenue.toLocaleString("vi-VN")} VND`, 14, 30);
    doc.text(`Tong so order: ${totalOrders}`, 14, 36);
    doc.text(`So ban phuc vu: ${totalTables}`, 14, 42);

    autoTable(doc, {
      startY: 50,
      head: [["Ban", "Mon", "SL", "Don gia", "Thanh tien", "Tong bill"]],
      body: tableDetails.flatMap(td =>
        td.items.map((item, i) => [
          i === 0 ? td.tableName : "",
          item.name,
          item.quantity,
          item.price.toLocaleString("vi-VN"),
          (item.quantity * item.price).toLocaleString("vi-VN"),
          i === 0 ? td.total.toLocaleString("vi-VN") : "",
        ])
      ),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
    });

    doc.save(`doanh-thu-${restaurantName}-${Date.now()}.pdf`);
  };

  const printTableBill = (detail: TableDetail) => {
    import("jspdf").then(({ default: jsPDF }) => {
      import("jspdf-autotable").then(({ default: autoTable }) => {
        const doc = new jsPDF({ unit: "mm", format: [80, 200] });
        const w = 80;

        doc.setFontSize(12);
        doc.text(restaurantName || "Nha hang", w / 2, 10, { align: "center" });
        doc.setFontSize(8);
        doc.text(detail.tableName, w / 2, 16, { align: "center" });
        doc.text(new Date(detail.paidAt).toLocaleString("vi-VN"), w / 2, 20, { align: "center" });
        doc.line(5, 23, w - 5, 23);

        autoTable(doc, {
          startY: 26,
          margin: { left: 5, right: 5 },
          head: [["Mon", "SL", "Gia", "T.Tien"]],
          body: detail.items.map(i => [
            i.name, i.quantity.toString(),
            i.price.toLocaleString("vi-VN"),
            (i.quantity * i.price).toLocaleString("vi-VN"),
          ]),
          styles: { fontSize: 7, cellPadding: 1 },
          headStyles: { fillColor: [50, 50, 50] },
          theme: "grid",
        });

        const finalY = (doc as any).lastAutoTable?.finalY || 60;
        doc.setFontSize(10);
        doc.text(`TONG: ${detail.total.toLocaleString("vi-VN")} VND`, w / 2, finalY + 6, { align: "center" });
        doc.setFontSize(8);
        doc.text("DA THANH TOAN", w / 2, finalY + 12, { align: "center" });

        doc.save(`bill-${detail.tableName}-${Date.now()}.pdf`);
      });
    });
  };

  const filters: { value: TimeFilter; label: string }[] = [
    { value: "today", label: "Hôm nay" },
    { value: "week", label: "Tuần này" },
    { value: "month", label: "Tháng này" },
    { value: "year", label: "Năm nay" },
    { value: "custom", label: "Tùy chỉnh" },
  ];

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex gap-2 flex-wrap">
          {filters.map((f) => (
            <Button key={f.value} variant={filter === f.value ? "default" : "outline"} size="sm" onClick={() => setFilter(f.value)}>
              {f.label}
            </Button>
          ))}
        </div>
        {filter === "custom" && (
          <div className="flex gap-2 items-end">
            <div>
              <Label className="text-xs">Từ</Label>
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 w-36" />
            </div>
            <div>
              <Label className="text-xs">Đến</Label>
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 w-36" />
            </div>
            <Button size="sm" onClick={fetchReport}>Lọc</Button>
          </div>
        )}
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Số bàn phục vụ</CardTitle>
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalTables}</p>
          </CardContent>
        </Card>
      </div>

      {/* Export buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={exportExcel}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Xuất Excel
        </Button>
        <Button variant="outline" size="sm" onClick={exportPDF}>
          <FileText className="mr-2 h-4 w-4" /> Xuất PDF
        </Button>
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

      {/* Table details */}
      {tableDetails.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Chi tiết theo bàn</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bàn</TableHead>
                    <TableHead>Món đã order</TableHead>
                    <TableHead className="text-right">Tổng bill</TableHead>
                    <TableHead>Ngày</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableDetails.map((td) => (
                    <TableRow key={td.orderId} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedBill(td)}>
                      <TableCell className="font-medium">{td.tableName}</TableCell>
                      <TableCell>
                        <div className="text-sm space-y-0.5">
                          {td.items.slice(0, 3).map((item, i) => (
                            <span key={i} className="block">{item.name} x{item.quantity}</span>
                          ))}
                          {td.items.length > 3 && <span className="text-muted-foreground">+{td.items.length - 3} món khác</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{td.total.toLocaleString("vi-VN")}₫</TableCell>
                      <TableCell className="text-sm">{new Date(td.paidAt).toLocaleString("vi-VN")}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); printTableBill(td); }}>
                          <Receipt className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bill preview dialog */}
      <Dialog open={!!selectedBill} onOpenChange={open => !open && setSelectedBill(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" /> Bill - {selectedBill?.tableName}
            </DialogTitle>
          </DialogHeader>
          {selectedBill && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{new Date(selectedBill.paidAt).toLocaleString("vi-VN")}</p>
              <div className="space-y-2">
                {selectedBill.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{item.name} x{item.quantity} @ {item.price.toLocaleString("vi-VN")}₫</span>
                    <span>{(item.quantity * item.price).toLocaleString("vi-VN")}₫</span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Tổng cộng</span>
                <span className="text-primary">{selectedBill.total.toLocaleString("vi-VN")}₫</span>
              </div>
              <Badge className="bg-success text-success-foreground">ĐÃ THANH TOÁN</Badge>
              <Button variant="outline" className="w-full" onClick={() => printTableBill(selectedBill)}>
                <FileText className="mr-2 h-4 w-4" /> Xuất bill PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
