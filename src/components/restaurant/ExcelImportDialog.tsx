import { useRef, useState } from "react";
import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSpreadsheet, Download, Upload, Loader2, Save } from "lucide-react";

interface MenuRow { name: string; category: string; price: number; available: boolean; dup: boolean; checked: boolean }
interface TableRow { name: string; dup: boolean; checked: boolean }

export default function ExcelImportDialog({
  restaurantId,
  onImported,
}: { restaurantId: string; onImported?: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuRows, setMenuRows] = useState<MenuRow[]>([]);
  const [tableRows, setTableRows] = useState<TableRow[]>([]);

  const downloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const menu = wb.addWorksheet("Thực đơn");
    menu.columns = [
      { header: "Tên món", key: "name", width: 32 },
      { header: "Danh mục", key: "category", width: 20 },
      { header: "Giá (VNĐ)", key: "price", width: 16 },
      { header: "Còn bán (x/để trống)", key: "available", width: 22 },
    ];
    menu.addRow({ name: "Phở bò", category: "Món chính", price: 55000, available: "x" });
    menu.addRow({ name: "Trà đá", category: "Nước", price: 3000, available: "x" });

    const tbl = wb.addWorksheet("Bàn");
    tbl.columns = [{ header: "Tên bàn", key: "name", width: 24 }];
    tbl.addRow({ name: "Bàn 1" });
    tbl.addRow({ name: "Bàn 2" });

    [menu, tbl].forEach((ws) => {
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).alignment = { vertical: "middle" };
    });

    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "mau-thuc-don-va-ban.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const cellText = (v: unknown) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "object" && v !== null && "text" in (v as Record<string, unknown>)) return String((v as { text: string }).text);
    return String(v).trim();
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());

      const [existingMenu, existingTables] = await Promise.all([
        supabase.from("menu_items").select("name").eq("restaurant_id", restaurantId),
        supabase.from("tables").select("name").eq("restaurant_id", restaurantId),
      ]);
      const menuNames = new Set((existingMenu.data ?? []).map((m) => m.name.trim().toLowerCase()));
      const tableNames = new Set((existingTables.data ?? []).map((t) => t.name.trim().toLowerCase()));

      const menuWs = wb.getWorksheet("Thực đơn") ?? wb.worksheets[0];
      const tableWs = wb.getWorksheet("Bàn") ?? wb.worksheets[1];

      const mRows: MenuRow[] = [];
      const seenM = new Set<string>();
      menuWs?.eachRow((row, idx) => {
        if (idx === 1) return;
        const name = cellText(row.getCell(1).value);
        if (!name) return;
        const key = name.toLowerCase();
        const dup = menuNames.has(key) || seenM.has(key);
        seenM.add(key);
        const priceRaw = cellText(row.getCell(3).value).replace(/[^\d.-]/g, "");
        mRows.push({
          name,
          category: cellText(row.getCell(2).value) || "Khác",
          price: Number(priceRaw) || 0,
          available: cellText(row.getCell(4).value).toLowerCase() !== "" ,
          dup,
          checked: !dup,
        });
      });

      const tRows: TableRow[] = [];
      const seenT = new Set<string>();
      tableWs?.eachRow((row, idx) => {
        if (idx === 1) return;
        const name = cellText(row.getCell(1).value);
        if (!name) return;
        const key = name.toLowerCase();
        const dup = tableNames.has(key) || seenT.has(key);
        seenT.add(key);
        tRows.push({ name, dup, checked: !dup });
      });

      setMenuRows(mRows);
      setTableRows(tRows);
      if (!mRows.length && !tRows.length) {
        toast({ title: "Không có dữ liệu", description: "File không có dòng nào hợp lệ", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Lỗi đọc file", description: (e as Error).message, variant: "destructive" });
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    const m = menuRows.filter((r) => r.checked);
    const t = tableRows.filter((r) => r.checked);
    if (!m.length && !t.length) {
      toast({ title: "Chưa chọn dòng nào", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (m.length) {
        const { error } = await supabase.from("menu_items").insert(
          m.map((r) => ({ restaurant_id: restaurantId, name: r.name, category: r.category, price: r.price, available: r.available }))
        );
        if (error) throw error;
      }
      if (t.length) {
        const { error } = await supabase.from("tables").insert(
          t.map((r) => ({ restaurant_id: restaurantId, name: r.name }))
        );
        if (error) throw error;
      }
      toast({ title: "Đã thêm", description: `${m.length} món · ${t.length} bàn` });
      setMenuRows([]);
      setTableRows([]);
      setOpen(false);
      onImported?.();
    } catch (e) {
      toast({ title: "Lỗi lưu dữ liệu", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const hasData = menuRows.length > 0 || tableRows.length > 0;
  const selectedCount = menuRows.filter((r) => r.checked).length + tableRows.filter((r) => r.checked).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="Nhập Thực đơn & Bàn từ Excel">
          <FileSpreadsheet className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nhập Thực đơn & Bàn từ Excel</DialogTitle>
          <DialogDescription>
            Tải file mẫu (2 sheet: Thực đơn, Bàn), nhập thông tin rồi import lại để duyệt trước khi lưu.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" /> Tải file mẫu
          </Button>
          <Button onClick={() => fileRef.current?.click()} disabled={parsing}>
            {parsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Chọn file Excel
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        {hasData && (
          <Tabs defaultValue="menu" className="w-full">
            <TabsList>
              <TabsTrigger value="menu">Thực đơn ({menuRows.length})</TabsTrigger>
              <TabsTrigger value="tables">Bàn ({tableRows.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="menu" className="mt-3 space-y-2">
              {menuRows.length === 0 && <p className="text-sm text-muted-foreground">Không có món nào</p>}
              {menuRows.map((r, i) => (
                <div key={i} className={`flex items-center gap-3 rounded-2xl border p-3 ${r.dup ? "border-destructive bg-destructive/10" : "bg-card"}`}>
                  <Checkbox
                    checked={r.checked}
                    onCheckedChange={(v) => setMenuRows((prev) => prev.map((x, j) => (j === i ? { ...x, checked: !!v } : x)))}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-medium ${r.dup ? "text-destructive" : ""}`}>{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.category} · {r.price.toLocaleString("vi-VN")}đ · {r.available ? "Còn bán" : "Hết"}</p>
                  </div>
                  {r.dup && <Badge variant="destructive">Trùng tên</Badge>}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="tables" className="mt-3 space-y-2">
              {tableRows.length === 0 && <p className="text-sm text-muted-foreground">Không có bàn nào</p>}
              {tableRows.map((r, i) => (
                <div key={i} className={`flex items-center gap-3 rounded-2xl border p-3 ${r.dup ? "border-destructive bg-destructive/10" : "bg-card"}`}>
                  <Checkbox
                    checked={r.checked}
                    onCheckedChange={(v) => setTableRows((prev) => prev.map((x, j) => (j === i ? { ...x, checked: !!v } : x)))}
                  />
                  <p className={`flex-1 truncate font-medium ${r.dup ? "text-destructive" : ""}`}>{r.name}</p>
                  {r.dup && <Badge variant="destructive">Trùng tên</Badge>}
                </div>
              ))}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Đóng</Button>
          <Button onClick={save} disabled={!hasData || saving || selectedCount === 0}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Lưu ({selectedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
