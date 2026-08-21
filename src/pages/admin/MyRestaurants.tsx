import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Store, MapPin, Loader2, Trash2, Edit, History, RotateCcw } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & { deleted_at?: string | null };

const RETENTION_DAYS = 15;

export default function MyRestaurants() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [deletedList, setDeletedList] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Restaurant | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Restaurant | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const fetchRestaurants = async () => {
    if (!user) return;
    setLoading(true);
    await supabase.rpc("purge_expired_restaurants");
    const { data } = await supabase
      .from("restaurants")
      .select("*")
      .eq("admin_id", user.id)
      .order("created_at", { ascending: false });
    const all = (data || []) as Restaurant[];
    setRestaurants(all.filter((r) => !r.deleted_at));
    setDeletedList(all.filter((r) => !!r.deleted_at));
    setLoading(false);
  };

  useEffect(() => { fetchRestaurants(); }, [user]);


  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("restaurants").insert({
      name: name.trim(),
      address: address.trim() || null,
      admin_id: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã tạo nhà hàng" });
      setOpen(false);
      setName("");
      setAddress("");
      fetchRestaurants();
    }
  };

  const handleEdit = async () => {
    if (!editTarget || !editName.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("restaurants").update({
      name: editName.trim(),
      address: editAddress.trim() || null,
    }).eq("id", editTarget.id);
    setSubmitting(false);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã cập nhật nhà hàng" });
      setEditOpen(false);
      fetchRestaurants();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || confirmText.trim().toUpperCase() !== "YES") return;
    setSubmitting(true);
    const { error } = await supabase
      .from("restaurants")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", deleteTarget.id);
    setSubmitting(false);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã xóa nhà hàng", description: `Có thể khôi phục trong ${RETENTION_DAYS} ngày` });
    setDeleteTarget(null);
    setConfirmText("");
    fetchRestaurants();
  };

  const handleRestore = async (r: Restaurant) => {
    const { error } = await supabase
      .from("restaurants")
      .update({ deleted_at: null } as never)
      .eq("id", r.id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đã khôi phục nhà hàng" });
    fetchRestaurants();
  };

  const daysLeft = (deletedAt: string) => {
    const ms = new Date(deletedAt).getTime() + RETENTION_DAYS * 86400000 - Date.now();
    return Math.max(0, Math.ceil(ms / 86400000));
  };


  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nhà hàng của tôi</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Thêm nhà hàng</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Thêm nhà hàng mới</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tên nhà hàng</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhà hàng ABC" />
              </div>
              <div className="space-y-2">
                <Label>Địa chỉ</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Nguyễn Huệ..." />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={submitting || !name.trim()}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Tạo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {restaurants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Store className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Bạn chưa có nhà hàng nào</p>
            <Button className="mt-4" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Tạo nhà hàng đầu tiên
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((r) => (
            <Card key={r.id} className="group hover:shadow-md transition-shadow">
              <Link to={`/admin/restaurant/${r.id}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Store className="h-4 w-4 text-accent" />
                    {r.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {r.address && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {r.address}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Tạo: {new Date(r.created_at).toLocaleDateString("vi-VN")}
                  </p>
                </CardContent>
              </Link>
              <div className="px-6 pb-4 flex gap-2">
                <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); setEditTarget(r); setEditName(r.name); setEditAddress(r.address || ""); setEditOpen(true); }}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); setDeleteTarget(r); setConfirmText(""); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {deletedList.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Lịch sử nhà hàng đã xóa
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Có thể khôi phục trong {RETENTION_DAYS} ngày, sau đó tự xóa vĩnh viễn.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {deletedList.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border p-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Xóa: {new Date(r.deleted_at!).toLocaleString("vi-VN")} · Còn {daysLeft(r.deleted_at!)} ngày
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleRestore(r)}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Khôi phục
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa nhà hàng "{deleteTarget?.name}"?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Nhà hàng sẽ được lưu ở lịch sử và có thể khôi phục trong {RETENTION_DAYS} ngày, sau đó xóa vĩnh viễn.
            </p>
            <div className="space-y-2">
              <Label>Nhập <span className="font-bold">YES</span> để xác nhận</Label>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="YES" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setConfirmText(""); }}>Hủy bỏ</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={submitting || confirmText.trim().toUpperCase() !== "YES"}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Xác nhận xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Restaurant Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa nhà hàng</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tên nhà hàng</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Địa chỉ</Label>
              <Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEdit} disabled={submitting || !editName.trim()}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
