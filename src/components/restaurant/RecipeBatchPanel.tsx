import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { ClipboardList, History, Loader2, Printer, Search, Trash2 } from "lucide-react";
import { matchSearch } from "@/lib/searchUtils";
import { printRecipeBatches, type BatchIngredient } from "@/lib/printRecipeBatches";

type Recipe = {
  id: string;
  name: string;
  note: string | null;
  recipe_ingredients: { id: string; name: string; amount: number; unit: string }[];
};

type Batch = {
  id: string;
  recipe_name: string;
  quantity: number;
  note: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  ingredients: BatchIngredient[];
};

interface Props {
  restaurantId: string;
  restaurantName: string;
}

export default function RecipeBatchPanel({ restaurantId, restaurantName }: Props) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  const [pickOpen, setPickOpen] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [picked, setPicked] = useState<Recipe | null>(null);
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchBatches = async () => {
    const { data, error } = await supabase
      .from("recipe_batches")
      .select("id, recipe_name, quantity, note, created_by, created_by_name, created_at, ingredients")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    else
      setBatches(
        (data ?? []).map((b) => ({
          ...b,
          quantity: Number(b.quantity),
          ingredients: (b.ingredients as unknown as BatchIngredient[]) ?? [],
        })),
      );
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const openPicker = async () => {
    setPicked(null);
    setQty("1");
    setNote("");
    setRecipeSearch("");
    setPickOpen(true);
    const { data } = await supabase
      .from("recipes")
      .select("id, name, note, recipe_ingredients(id, name, amount, unit)")
      .eq("restaurant_id", restaurantId)
      .order("name");
    setRecipes((data ?? []) as Recipe[]);
  };

  const filteredRecipes = useMemo(() => {
    const q = recipeSearch.trim();
    if (!q) return recipes;
    return recipes.filter((r) => matchSearch(r.name, q));
  }, [recipes, recipeSearch]);

  const qtyNum = Math.max(0, Number(qty.replace(",", ".")) || 0);

  const saveBatch = async () => {
    if (!picked) return;
    if (qtyNum <= 0) {
      toast({ title: "Số lượng phải lớn hơn 0", variant: "destructive" });
      return;
    }
    setSaving(true);
    const ingredients: BatchIngredient[] = picked.recipe_ingredients.map((i) => ({
      name: i.name,
      amount: Number(i.amount),
      unit: i.unit,
      total: Number((Number(i.amount) * qtyNum).toFixed(3)),
    }));
    const { data, error } = await supabase
      .from("recipe_batches")
      .insert({
        restaurant_id: restaurantId,
        recipe_id: picked.id,
        recipe_name: picked.name,
        quantity: qtyNum,
        note: note.trim() || picked.note || null,
        created_by: profile?.id ?? null,
        created_by_name: profile?.full_name || profile?.email || "Không rõ",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ingredients: ingredients as any,
      })
      .select("id, recipe_name, quantity, note, created_by, created_by_name, created_at, ingredients")
      .single();
    setSaving(false);
    if (error || !data) {
      toast({ title: "Lỗi", description: error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã tạo bản thành phần món" });
    setPickOpen(false);
    await fetchBatches();
    printRecipeBatches(restaurantName, [
      {
        recipe_name: data.recipe_name,
        quantity: Number(data.quantity),
        note: data.note,
        created_by_name: data.created_by_name,
        created_at: data.created_at,
        ingredients,
      },
    ]);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, Batch[]>();
    for (const b of batches) {
      const key = new Date(b.created_at).toLocaleDateString("vi-VN");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return Array.from(map.entries());
  }, [batches]);

  const printSelected = () => {
    const list = batches.filter((b) => selected.has(b.id));
    if (!list.length) return;
    printRecipeBatches(
      restaurantName,
      list.map((b) => ({
        recipe_name: b.recipe_name,
        quantity: b.quantity,
        note: b.note,
        created_by_name: b.created_by_name,
        created_at: b.created_at,
        ingredients: b.ingredients,
      })),
    );
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("recipe_batches").delete().eq("id", deleteId);
    if (error) toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Đã xoá bản thành phần" });
      await fetchBatches();
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Lịch sử định lượng</h2>
          <Badge variant="secondary">{batches.length}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={printSelected} disabled={selected.size === 0}>
            <Printer className="mr-2 h-4 w-4" /> In đã chọn ({selected.size})
          </Button>
          <Button onClick={openPicker}>
            <ClipboardList className="mr-2 h-4 w-4" /> Tạo thành phần món
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : batches.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Chưa có bản thành phần món nào được tạo.
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, items]) => (
            <div key={day} className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Ngày {day}</p>
              <div className="grid gap-2 md:grid-cols-2">
                {items.map((b) => (
                  <Card key={b.id} className="flex items-start gap-3 p-3">
                    <Checkbox
                      className="mt-1"
                      checked={selected.has(b.id)}
                      onCheckedChange={(v) =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (v) next.add(b.id);
                          else next.delete(b.id);
                          return next;
                        })
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{b.recipe_name}</p>
                        <Badge variant="outline">× {b.quantity}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {b.created_by_name || "Không rõ"} •{" "}
                        {new Date(b.created_at).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {b.ingredients.map((i) => `${i.name} ${i.total}${i.unit}`).join(" • ") ||
                          "Không có nguyên liệu"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          printRecipeBatches(restaurantName, [
                            {
                              recipe_name: b.recipe_name,
                              quantity: b.quantity,
                              note: b.note,
                              created_by_name: b.created_by_name,
                              created_at: b.created_at,
                              ingredients: b.ingredients,
                            },
                          ])
                        }
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteId(b.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create batch dialog */}
      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tạo thành phần món</DialogTitle>
            <DialogDescription>
              Chọn món trong Công thức &amp; Định lượng, nhập số lượng rồi bấm Lưu để tạo bản thành phần.
            </DialogDescription>
          </DialogHeader>

          {!picked ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Tìm món..."
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-[50vh] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên món</TableHead>
                      <TableHead className="w-32 text-right">Nguyên liệu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecipes.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => {
                          setPicked(r);
                          setQty("1");
                          setNote(r.note ?? "");
                        }}
                      >
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {r.recipe_ingredients.length}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredRecipes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          Không có món nào
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{picked.name}</p>
                <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
                  Chọn món khác
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Số lượng phần *</Label>
                  <Input type="number" min="0" step="1" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label>Ghi chú</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tuỳ chọn" />
                </div>
              </div>
              <div className="max-h-[40vh] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nguyên vật liệu</TableHead>
                      <TableHead className="text-right">Định mức/phần</TableHead>
                      <TableHead className="text-right">Tổng cần</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {picked.recipe_ingredients.map((i) => (
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
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPickOpen(false)}>
              Hủy bỏ
            </Button>
            <Button onClick={saveBatch} disabled={!picked || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Lưu &amp; In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá bản thành phần này?</AlertDialogTitle>
            <AlertDialogDescription>Hành động không thể hoàn tác.</AlertDialogDescription>
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
