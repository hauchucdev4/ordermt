import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2,
  Plus,
  Trash2,
  FileSpreadsheet,
  Upload,
  Calculator,
  Pencil,
  ScrollText,
  Search,
} from "lucide-react";
import { exportRecipesExcel, parseRecipesExcel, type RecipeData } from "@/lib/recipeExcel";
import { normalizeText } from "@/lib/searchUtils";

type Recipe = {
  id: string;
  name: string;
  note: string | null;
  recipe_ingredients: { id: string; name: string; amount: number; unit: string }[];
};

const UNITS = ["g", "kg", "ml", "l", "cái", "quả", "lá", "muỗng", "chén", "gói", "phần", "con"];

interface DraftIngredient {
  name: string;
  amount: string;
  unit: string;
}

interface Props {
  restaurantId: string;
  restaurantName: string;
  canEdit?: boolean;
}

export default function RecipeManagement({ restaurantId, restaurantName, canEdit = true }: Props) {
  const { toast } = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // form dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dishName, setDishName] = useState("");
  const [dishNote, setDishNote] = useState("");
  const [draft, setDraft] = useState<DraftIngredient[]>([{ name: "", amount: "", unit: "g" }]);
  const [saving, setSaving] = useState(false);

  // calc dialog
  const [calcRecipe, setCalcRecipe] = useState<Recipe | null>(null);
  const [calcQty, setCalcQty] = useState("1");

  // delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // import
  const fileRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [imported, setImported] = useState<RecipeData[]>([]);
  const [selectedImport, setSelectedImport] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  const fetchRecipes = async () => {
    const { data, error } = await supabase
      .from("recipes")
      .select("id, name, note, recipe_ingredients(id, name, amount, unit)")
      .eq("restaurant_id", restaurantId)
      .order("name");
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      setRecipes((data ?? []) as Recipe[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchRecipes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const filtered = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return recipes;
    return recipes.filter(
      (r) =>
        normalizeText(r.name).includes(q) ||
        r.recipe_ingredients.some((i) => normalizeText(i.name).includes(q)),
    );
  }, [recipes, search]);

  const openCreate = () => {
    setEditingId(null);
    setDishName("");
    setDishNote("");
    setDraft([{ name: "", amount: "", unit: "g" }]);
    setFormOpen(true);
  };

  const openEdit = (r: Recipe) => {
    setEditingId(r.id);
    setDishName(r.name);
    setDishNote(r.note ?? "");
    setDraft(
      r.recipe_ingredients.length
        ? r.recipe_ingredients.map((i) => ({ name: i.name, amount: String(i.amount), unit: i.unit }))
        : [{ name: "", amount: "", unit: "g" }],
    );
    setFormOpen(true);
  };

  const updateDraft = (idx: number, patch: Partial<DraftIngredient>) =>
    setDraft((d) => d.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  const saveRecipe = async () => {
    if (!dishName.trim()) {
      toast({ title: "Thiếu tên món", variant: "destructive" });
      return;
    }
    const rows = draft
      .filter((d) => d.name.trim())
      .map((d) => ({
        name: d.name.trim(),
        amount: Number(d.amount.replace(",", ".")) || 0,
        unit: d.unit.trim() || "g",
      }));
    setSaving(true);
    try {
      let recipeId = editingId;
      if (editingId) {
        const { error } = await supabase
          .from("recipes")
          .update({ name: dishName.trim(), note: dishNote.trim() || null })
          .eq("id", editingId);
        if (error) throw error;
        await supabase.from("recipe_ingredients").delete().eq("recipe_id", editingId);
      } else {
        const { data, error } = await supabase
          .from("recipes")
          .insert({ restaurant_id: restaurantId, name: dishName.trim(), note: dishNote.trim() || null })
          .select("id")
          .single();
        if (error) throw error;
        recipeId = data.id;
      }
      if (rows.length && recipeId) {
        const { error } = await supabase
          .from("recipe_ingredients")
          .insert(rows.map((r) => ({ ...r, recipe_id: recipeId })));
        if (error) throw error;
      }
      toast({ title: editingId ? "Đã cập nhật định lượng" : "Đã thêm định lượng món" });
      setFormOpen(false);
      await fetchRecipes();
    } catch (e) {
      toast({ title: "Lỗi", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("recipes").delete().eq("id", deleteId);
    if (error) toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Đã xoá định lượng món" });
      await fetchRecipes();
    }
    setDeleteId(null);
  };

  const handleExport = async () => {
    if (!recipes.length) {
      toast({ title: "Chưa có định lượng nào để xuất", variant: "destructive" });
      return;
    }
    await exportRecipesExcel(
      restaurantName,
      recipes.map((r) => ({
        name: r.name,
        note: r.note,
        ingredients: r.recipe_ingredients.map((i) => ({ name: i.name, amount: Number(i.amount), unit: i.unit })),
      })),
    );
    toast({ title: "Đã xuất file Excel định lượng" });
  };

  const handleFile = async (file: File) => {
    try {
      const parsed = await parseRecipesExcel(file);
      if (!parsed.length) {
        toast({ title: "Không đọc được món nào trong file", variant: "destructive" });
        return;
      }
      setImported(parsed);
      setSelectedImport(new Set(parsed.map((_, i) => i)));
      setImportOpen(true);
    } catch (e) {
      toast({ title: "Lỗi đọc file", description: (e as Error).message, variant: "destructive" });
    }
  };

  const approveImport = async () => {
    const picked = imported.filter((_, i) => selectedImport.has(i));
    if (!picked.length) return;
    setImporting(true);
    try {
      for (const r of picked) {
        const { data, error } = await supabase
          .from("recipes")
          .insert({ restaurant_id: restaurantId, name: r.name, note: r.note ?? null })
          .select("id")
          .single();
        if (error) throw error;
        if (r.ingredients.length) {
          const { error: ingErr } = await supabase.from("recipe_ingredients").insert(
            r.ingredients.map((i) => ({ recipe_id: data.id, name: i.name, amount: i.amount, unit: i.unit })),
          );
          if (ingErr) throw ingErr;
        }
      }
      toast({ title: `Đã import ${picked.length} món vào ${restaurantName}` });
      setImportOpen(false);
      setImported([]);
      await fetchRecipes();
    } catch (e) {
      toast({ title: "Lỗi import", description: (e as Error).message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const qtyNum = Math.max(0, Number(calcQty.replace(",", ".")) || 0);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm món hoặc nguyên liệu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={handleExport}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Xuất Excel
        </Button>
        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Import Excel
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Thêm định lượng món
            </Button>
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <ScrollText className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">Chưa có định lượng món nào</p>
          {canEdit && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Thêm định lượng món
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <Card
              key={r.id}
              className="cursor-pointer p-4 transition-colors hover:border-primary"
              onClick={() => {
                setCalcRecipe(r);
                setCalcQty("1");
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{r.name}</h3>
                  <Badge variant="secondary" className="mt-1">
                    {r.recipe_ingredients.length} nguyên liệu
                  </Badge>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(r);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(r.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {r.recipe_ingredients.slice(0, 4).map((i) => (
                  <li key={i.id} className="flex justify-between gap-2">
                    <span className="truncate">{i.name}</span>
                    <span className="shrink-0 font-medium text-foreground">
                      {Number(i.amount)} {i.unit}
                    </span>
                  </li>
                ))}
                {r.recipe_ingredients.length > 4 && (
                  <li className="text-xs">+{r.recipe_ingredients.length - 4} nguyên liệu khác</li>
                )}
              </ul>
              <p className="mt-3 flex items-center gap-1 text-xs text-primary">
                <Calculator className="h-3 w-3" /> Bấm để tính định lượng
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Form dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Sửa định lượng món" : "Thêm định lượng món mới"}</DialogTitle>
            <DialogDescription>
              Nhập tên món và các nguyên vật liệu kèm định mức, đơn vị tính cho 1 phần.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tên món *</Label>
                <Input value={dishName} onChange={(e) => setDishName(e.target.value)} placeholder="VD: Phở bò" />
              </div>
              <div className="space-y-1.5">
                <Label>Ghi chú</Label>
                <Input value={dishNote} onChange={(e) => setDishNote(e.target.value)} placeholder="Tuỳ chọn" />
              </div>
            </div>

            <div className="max-h-[45vh] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nguyên vật liệu</TableHead>
                    <TableHead className="w-28">Định mức</TableHead>
                    <TableHead className="w-32">ĐVT</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draft.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Input
                          value={row.name}
                          onChange={(e) => updateDraft(idx, { name: e.target.value })}
                          placeholder="VD: Thịt bò"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.amount}
                          onChange={(e) => updateDraft(idx, { amount: e.target.value })}
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          list="recipe-units"
                          value={row.unit}
                          onChange={(e) => updateDraft(idx, { unit: e.target.value })}
                          placeholder="g"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => setDraft((d) => d.filter((_, i) => i !== idx))}
                          disabled={draft.length === 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <datalist id="recipe-units">
                {UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>

            <Button
              variant="outline"
              onClick={() => setDraft((d) => [...d, { name: "", amount: "", unit: "g" }])}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" /> Thêm nguyên liệu
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Hủy bỏ
            </Button>
            <Button onClick={saveRecipe} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calculator dialog */}
      <Dialog open={!!calcRecipe} onOpenChange={(o) => !o && setCalcRecipe(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{calcRecipe?.name}</DialogTitle>
            <DialogDescription>Nhập số lượng phần cần làm để tính nguyên vật liệu chuẩn bị.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Số lượng phần</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={calcQty}
                onChange={(e) => setCalcQty(e.target.value)}
                autoFocus
              />
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nguyên vật liệu</TableHead>
                    <TableHead className="text-right">Định mức/phần</TableHead>
                    <TableHead className="text-right">Tổng cần</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calcRecipe?.recipe_ingredients.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.name}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {Number(i.amount)} {i.unit}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {Number((Number(i.amount) * qtyNum).toFixed(3))} {i.unit}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCalcRecipe(null)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import preview */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import định lượng từ Excel</DialogTitle>
            <DialogDescription>
              Chọn các món cần import vào {restaurantName}, sau đó bấm Duyệt để lưu.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {imported.map((r, idx) => (
              <label
                key={idx}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50"
              >
                <Checkbox
                  checked={selectedImport.has(idx)}
                  onCheckedChange={(v) =>
                    setSelectedImport((s) => {
                      const next = new Set(s);
                      if (v) next.add(idx);
                      else next.delete(idx);
                      return next;
                    })
                  }
                />
                <div className="min-w-0">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.ingredients.map((i) => `${i.name} ${i.amount}${i.unit}`).join(" • ") || "Không có nguyên liệu"}
                  </p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Hủy bỏ
            </Button>
            <Button onClick={approveImport} disabled={importing || selectedImport.size === 0}>
              {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Duyệt ({selectedImport.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá định lượng món?</AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ nguyên vật liệu của món này sẽ bị xoá. Hành động không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
