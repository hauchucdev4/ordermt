import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Loader2, Trash2, Edit, LayoutGrid, Search } from "lucide-react";
import { matchSearch } from "@/lib/searchUtils";
import type { Database } from "@/integrations/supabase/types";

type TableRow = Database["public"]["Tables"]["tables"]["Row"];

export default function TableManagement({ restaurantId }: { restaurantId: string }) {
  const { toast } = useToast();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TableRow | null>(null);
  const [editName, setEditName] = useState("");

  const fetchTables = async (showLoader = false) => {
    if (showLoader) setLoading(true);
    const { data } = await supabase
      .from("tables")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("name");
    setTables(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTables(true);
    const channel = supabase
      .channel(`table-mgmt-${restaurantId}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tables", filter: `restaurant_id=eq.${restaurantId}` }, () => fetchTables())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("tables").insert({ name: name.trim(), restaurant_id: restaurantId });
    setSubmitting(false);
    if (error) toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    else { toast({ title: "Đã thêm bàn" }); setAddOpen(false); setName(""); fetchTables(); }
  };

  const handleRename = async () => {
    if (!editTarget || !editName.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("tables").update({ name: editName.trim() }).eq("id", editTarget.id);
    setSubmitting(false);
    if (error) toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    else { toast({ title: "Đã đổi tên" }); setEditOpen(false); fetchTables(); }
  };

  const handleDelete = async (t: TableRow) => {
    if (!confirm(`Xóa bàn "${t.name}"?`)) return;
    setTables(prev => prev.filter(tb => tb.id !== t.id));
    await supabase.from("tables").delete().eq("id", t.id);
    toast({ title: "Đã xóa bàn" });
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setName(""); setAddOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Thêm bàn
        </Button>
      </div>

      {tables.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Chưa có bàn nào</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {tables.map((t) => (
            <Card key={t.id} className="text-center">
              <CardContent className="p-4 space-y-2">
                <p className="font-semibold">{t.name}</p>
                <Badge variant={t.status === "empty" ? "outline" : "default"}>
                  {t.status === "empty" ? "Trống" : "Có khách"}
                </Badge>
                <div className="flex justify-center gap-1 pt-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditTarget(t); setEditName(t.name); setEditOpen(true); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(t)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Thêm bàn mới</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Tên bàn</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bàn 1" />
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={submitting || !name.trim()}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Thêm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Đổi tên bàn</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Tên bàn mới</Label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={handleRename} disabled={submitting || !editName.trim()}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
