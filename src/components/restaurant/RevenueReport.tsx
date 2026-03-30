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
    const filterLabel = filter === "custom" ? `${customStart} - ${customEnd}` : filters.find(f => f.value === filter)?.label || filter;
    const summaryData = [
      ["BAO CAO DOANH THU"],
      [],
      ["Nha hang", restaurantName],
      ["Thoi gian", filterLabel],
      ["Ngay xuat", new Date().toLocaleString("vi-VN")],
      [],
      ["CHI TIEU", "GIA TRI"],
      ["Tong doanh thu (VND)", totalRevenue],
      ["Tong so hoa don", totalOrders],
      ["So ban phuc vu", totalTables],
      ["Doanh thu trung binh/hoa don (VND)", totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1["!cols"] = [{ wch: 32 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Tong quan");

    // Detail sheet
    const detailRows: any[][] = [
      ["STT", "Ban", "Mon", "So luong", "Don gia (VND)", "Thanh tien (VND)", "Tong hoa don (VND)", "Ngay thanh toan"],
    ];
    let stt = 0;
    tableDetails.forEach(td => {
      stt++;
      td.items.forEach((item, i) => {
        detailRows.push([
          i === 0 ? stt : "",
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
    // Grand total row
    detailRows.push([]);
    detailRows.push(["", "", "", "", "", "TONG CONG:", totalRevenue, ""]);

    const ws2 = XLSX.utils.aoa_to_sheet(detailRows);
    ws2["!cols"] = [
      { wch: 5 }, { wch: 12 }, { wch: 24 }, { wch: 9 },
      { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, ws2, "Chi tiet");

    // Daily summary sheet
    const dailyRows: any[][] = [["Ngay", "So hoa don", "Doanh thu (VND)"]];
    const dailyMap: Record<string, { count: number; revenue: number }> = {};
    tableDetails.forEach(td => {
      const day = new Date(td.paidAt).toLocaleDateString("vi-VN");
      if (!dailyMap[day]) dailyMap[day] = { count: 0, revenue: 0 };
      dailyMap[day].count++;
      dailyMap[day].revenue += td.total;
    });
    Object.entries(dailyMap).forEach(([day, d]) => {
      dailyRows.push([day, d.count, d.revenue]);
    });
    dailyRows.push([]);
    dailyRows.push(["TONG CONG", totalOrders, totalRevenue]);
    const ws3 = XLSX.utils.aoa_to_sheet(dailyRows);
    ws3["!cols"] = [{ wch: 16 }, { wch: 14 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Theo ngay");

    XLSX.writeFile(wb, `doanh-thu-${restaurantName}-${Date.now()}.xlsx`);
  };

  const exportPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const filterLabel = filter === "custom" ? `${customStart} - ${customEnd}` : filters.find(f => f.value === filter)?.label || filter;

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("BAO CAO DOANH THU", pw / 2, 20, { align: "center" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(restaurantName, pw / 2, 28, { align: "center" });
    doc.setFontSize(9);
    doc.text(`Thoi gian: ${filterLabel}  |  Ngay xuat: ${new Date().toLocaleString("vi-VN")}`, pw / 2, 34, { align: "center" });

    // Divider
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.8);
    doc.line(14, 37, pw - 14, 37);

    // Summary cards
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    const summaryY = 44;
    const cols = [
      { label: "Tong doanh thu", value: `${totalRevenue.toLocaleString("vi-VN")} VND` },
      { label: "Tong hoa don", value: `${totalOrders}` },
      { label: "So ban phuc vu", value: `${totalTables}` },
      { label: "TB/hoa don", value: `${totalOrders > 0 ? Math.round(totalRevenue / totalOrders).toLocaleString("vi-VN") : 0} VND` },
    ];
    const colW = (pw - 28) / cols.length;
    cols.forEach((c, i) => {
      const x = 14 + i * colW;
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(x, summaryY - 4, colW - 4, 16, 2, 2, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(c.label, x + (colW - 4) / 2, summaryY + 1, { align: "center" });
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(c.value, x + (colW - 4) / 2, summaryY + 9, { align: "center" });
    });

    // Detail table
    let stt = 0;
    autoTable(doc, {
      startY: summaryY + 18,
      head: [["STT", "Ban", "Mon", "SL", "Don gia", "Thanh tien", "Tong HD", "Ngay TT"]],
      body: tableDetails.flatMap(td => {
        stt++;
        return td.items.map((item, i) => [
          i === 0 ? stt : "",
          i === 0 ? td.tableName : "",
          item.name,
          item.quantity,
          item.price.toLocaleString("vi-VN"),
          (item.quantity * item.price).toLocaleString("vi-VN"),
          i === 0 ? td.total.toLocaleString("vi-VN") : "",
          i === 0 ? new Date(td.paidAt).toLocaleString("vi-VN") : "",
        ]);
      }),
      foot: [["", "", "", "", "", "TONG CONG:", totalRevenue.toLocaleString("vi-VN") + " VND", ""]],
      styles: { fontSize: 8, cellPadding: 2, textColor: [30, 30, 30] },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
      footStyles: { fillColor: [240, 240, 240], textColor: [30, 41, 59], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        3: { halign: "center", cellWidth: 10 },
        4: { halign: "right" },
        5: { halign: "right" },
        6: { halign: "right" },
      },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150, 150, 150);
      doc.text(`Trang ${i}/${pageCount}`, pw - 14, doc.internal.pageSize.getHeight() - 10, { align: "right" });
      doc.text(restaurantName, 14, doc.internal.pageSize.getHeight() - 10);
    }

    doc.save(`doanh-thu-${restaurantName}-${Date.now()}.pdf`);
  };

  const printTableBill = (detail: TableDetail) => {
    import("jspdf").then(({ default: jsPDF }) => {
      import("jspdf-autotable").then(({ default: autoTable }) => {
        const doc = new jsPDF({ unit: "mm", format: [80, 250] });
        const w = 80;
        let y = 8;

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(restaurantName || "Nha hang", w / 2, y, { align: "center" });
        y += 6;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("HOA DON THANH TOAN", w / 2, y, { align: "center" });
        y += 5;
        doc.setDrawColor(100);
        doc.setLineWidth(0.5);
        doc.line(5, y, w - 5, y);
        y += 4;

        doc.setFontSize(8);
        doc.text(`Ban: ${detail.tableName}`, 5, y);
        doc.text(`Ngay: ${new Date(detail.paidAt).toLocaleString("vi-VN")}`, w - 5, y, { align: "right" });
        y += 4;
        doc.setLineWidth(0.2);
        doc.line(5, y, w - 5, y);
        y += 1;

        autoTable(doc, {
          startY: y,
          margin: { left: 5, right: 5 },
          head: [["Mon", "SL", "Don gia", "T.Tien"]],
          body: detail.items.map(i => [
            i.name, i.quantity.toString(),
            i.price.toLocaleString("vi-VN"),
            (i.quantity * i.price).toLocaleString("vi-VN"),
          ]),
          styles: { fontSize: 7, cellPadding: 1.5, textColor: [30, 30, 30] },
          headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          theme: "grid",
          columnStyles: {
            0: { cellWidth: "auto" },
            1: { halign: "center", cellWidth: 8 },
            2: { halign: "right", cellWidth: 16 },
            3: { halign: "right", cellWidth: 18 },
          },
        });

        const finalY = (doc as any).lastAutoTable?.finalY || 80;
        let fy = finalY + 3;
        doc.setLineWidth(0.5);
        doc.line(5, fy, w - 5, fy);
        fy += 5;
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("TONG CONG:", 5, fy);
        doc.text(`${detail.total.toLocaleString("vi-VN")} VND`, w - 5, fy, { align: "right" });
        fy += 4;
        doc.setLineWidth(0.5);
        doc.line(5, fy, w - 5, fy);
        fy += 6;
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("DA THANH TOAN", w / 2, fy, { align: "center" });
        fy += 5;
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("Cam on quy khach!", w / 2, fy, { align: "center" });
        fy += 4;
        doc.text("Hen gap lai!", w / 2, fy, { align: "center" });

        doc.save(`hoa-don-${detail.tableName}-${Date.now()}.pdf`);
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
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <div className="bg-primary/5 border-b px-6 py-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Receipt className="h-5 w-5 text-primary" /> Hóa đơn - {selectedBill?.tableName}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {restaurantName && <span className="font-medium">{restaurantName} • </span>}
                {selectedBill && new Date(selectedBill.paidAt).toLocaleString("vi-VN")}
              </p>
            </DialogHeader>
          </div>
          {selectedBill && (
            <div className="px-6 py-4 space-y-4">
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
              <div className="flex justify-between items-center bg-primary/5 rounded-lg p-4">
                <span className="font-semibold text-lg">Tổng cộng</span>
                <span className="text-primary font-bold text-xl">{selectedBill.total.toLocaleString("vi-VN")}₫</span>
              </div>
              <div className="flex items-center justify-between">
                <Badge className="bg-green-500/20 text-green-700 dark:text-green-300">ĐÃ THANH TOÁN</Badge>
              </div>
            </div>
          )}
          <div className="border-t px-6 py-4">
            <Button variant="outline" className="w-full" onClick={() => selectedBill && printTableBill(selectedBill)}>
              <FileText className="mr-2 h-4 w-4" /> Xuất hóa đơn PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
