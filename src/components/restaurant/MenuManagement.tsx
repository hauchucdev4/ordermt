import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, Trash2, Edit, UtensilsCrossed, ImageIcon } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type MenuItem = Database["public"]["Tables"]["menu_items"]["Row"];

const DEFAULT_CATEGORIES = ["Khai vị", "Món chính", "Đồ uống", "Tráng miệng", "Khác"];

export default function MenuManagement({ restaurantId }: { restaurantId: string }) {
  const { toast } = useToast();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("all");

  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Khác");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("category")
      .order("name");
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [restaurantId]);

  const categories = [...new Set(items.map((i) => i.category))].sort();

  const openAdd = () => {
    setEditItem(null);
    setName(""); setCategory("Khác"); setPrice(""); setImageUrl("");
    setOpen(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditItem(item);
    setName(item.name);
    setCategory(item.category);
    setPrice(String(item.price));
    setImageUrl(item.image_url || "");
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !price) return;
    setSubmitting(true);
    const payload = {
      name: name.trim(),
      category: category.trim() || "Khác",
      price: parseFloat(price),
      image_url: imageUrl.trim() || null,
      restaurant_id: restaurantId,
    };

    if (editItem) {
      const { error } = await supabase.from("menu_items").update(payload).eq("id", editItem.id);
      if (error) toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      else toast({ title: "Đã cập nhật món" });
    } else {
      const { error } = await supabase.from("menu_items").insert(payload);
      if (error) toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      else toast({ title: "Đã thêm món" });
    }
    setSubmitting(false);
    setOpen(false);
    fetchItems();
  };

  const toggleAvailable = async (item: MenuItem) => {
    await supabase.from("menu_items").update({ available: !item.available }).eq("id", item.id);
    fetchItems();
  };

  const handleDelete = async (item: MenuItem) => {
    if (!confirm(`Xóa món "${item.name}"?`)) return;
    await supabase.from("menu_items").delete().eq("id", item.id);
    toast({ title: "Đã xóa món" });
    fetchItems();
  };

  const filtered = filterCat === "all" ? items : items.filter((i) => i.category === filterCat);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          <Button variant={filterCat === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterCat("all")}>Tất cả</Button>
          {categories.map((c) => (
            <Button key={c} variant={filterCat === c ? "default" : "outline"} size="sm" onClick={() => setFilterCat(c)}>{c}</Button>
          ))}
        </div>
        <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Thêm món</Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UtensilsCrossed className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Chưa có món ăn nào</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              {item.image_url ? (
                <div className="h-40 overflow-hidden">
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="h-40 bg-muted flex items-center justify-center">
                  <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                </div>
              )}
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-xs text-muted-foreground">{item.category}</p>
                  </div>
                  <p className="font-bold text-primary">{Number(item.price).toLocaleString("vi-VN")}₫</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch checked={item.available} onCheckedChange={() => toggleAvailable(item)} />
                    <span className="text-sm">{item.available ? "Còn" : "Hết"}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? "Sửa món ăn" : "Thêm món ăn mới"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tên món</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Phở bò" />
            </div>
            <div className="space-y-2">
              <Label>Danh mục</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Món chính" list="category-list" />
              <datalist id="category-list">
                {DEFAULT_CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label>Giá (VNĐ)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="50000" />
            </div>
            <div className="space-y-2">
              <Label>URL ảnh (tùy chọn)</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} disabled={submitting || !name.trim() || !price}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {editItem ? "Cập nhật" : "Thêm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
