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
import { Plus, Store, MapPin, Loader2, Trash2, Edit } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

export default function MyRestaurants() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRestaurants = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("restaurants")
      .select("*")
      .eq("admin_id", user.id)
      .order("created_at", { ascending: false });
    setRestaurants(data || []);
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

  const handleDelete = async (r: Restaurant) => {
    if (!confirm(`Xóa nhà hàng "${r.name}"?`)) return;
    await supabase.from("restaurants").delete().eq("id", r.id);
    toast({ title: "Đã xóa nhà hàng" });
    fetchRestaurants();
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
                <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); handleDelete(r); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
