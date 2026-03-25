import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Lock, Unlock, Trash2, Edit, KeyRound, Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function AdminManagement() {
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "locked">("all");
  const { toast } = useToast();

  // Edit dialog
  const [editAdmin, setEditAdmin] = useState<Profile | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // Reset password dialog
  const [resetAdmin, setResetAdmin] = useState<Profile | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");

  // Unlock dialog
  const [unlockAdmin, setUnlockAdmin] = useState<Profile | null>(null);
  const [unlockType, setUnlockType] = useState<"permanent" | "timed">("permanent");
  const [unlockDate, setUnlockDate] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const fetchAdmins = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "admin")
      .order("created_at", { ascending: false });
    setAdmins(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAdmins(); }, []);

  const filtered = admins.filter((a) => {
    if (filter !== "all" && a.status !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (a.full_name?.toLowerCase().includes(s) || a.email.toLowerCase().includes(s));
    }
    return true;
  });

  const handleLock = async (admin: Profile) => {
    setSubmitting(true);
    await supabase.from("profiles").update({ status: "locked" as const, lock_until: null }).eq("id", admin.id);
    toast({ title: `Đã khóa tài khoản ${admin.full_name}` });
    setSubmitting(false);
    fetchAdmins();
  };

  const handleUnlock = async () => {
    if (!unlockAdmin) return;
    setSubmitting(true);
    const update: { status: "active"; lock_until: string | null } = {
      status: "active",
      lock_until: unlockType === "timed" && unlockDate ? new Date(unlockDate).toISOString() : null,
    };
    await supabase.from("profiles").update(update).eq("id", unlockAdmin.id);
    toast({ title: `Đã mở khóa tài khoản ${unlockAdmin.full_name}` });
    setSubmitting(false);
    setUnlockAdmin(null);
    fetchAdmins();
  };

  const handleDelete = async (admin: Profile) => {
    if (!confirm(`Xóa tài khoản ${admin.full_name}?`)) return;
    await supabase.from("profiles").delete().eq("id", admin.id);
    toast({ title: "Đã xóa tài khoản" });
    fetchAdmins();
  };

  const handleEdit = async () => {
    if (!editAdmin) return;
    setSubmitting(true);
    await supabase.from("profiles").update({ full_name: editName, email: editEmail }).eq("id", editAdmin.id);
    toast({ title: "Đã cập nhật thông tin" });
    setSubmitting(false);
    setEditAdmin(null);
    fetchAdmins();
  };

  const handleResetPassword = async () => {
    if (!resetAdmin) return;
    if (resetPw.length < 8) { toast({ title: "Lỗi", description: "Tối thiểu 8 ký tự", variant: "destructive" }); return; }
    if (resetPw !== resetConfirm) { toast({ title: "Lỗi", description: "Mật khẩu không khớp", variant: "destructive" }); return; }
    setSubmitting(true);
    // Use edge function for admin password reset
    const { error } = await supabase.functions.invoke("admin-reset-password", {
      body: { userId: resetAdmin.id, newPassword: resetPw },
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã đặt lại mật khẩu" });
      setResetAdmin(null);
      setResetPw("");
      setResetConfirm("");
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
      active: { label: "Hoạt động", variant: "default" },
      pending: { label: "Chờ duyệt", variant: "secondary" },
      locked: { label: "Đã khóa", variant: "destructive" },
    };
    const info = map[status] || map.pending;
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Quản lý tài khoản Admin</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Tìm kiếm theo tên, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1">
          {(["all", "active", "pending", "locked"] as const).map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
              {{ all: "Tất cả", active: "Hoạt động", pending: "Chờ duyệt", locked: "Đã khóa" }[f]}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Họ tên</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Không tìm thấy admin nào</TableCell></TableRow>
            ) : (
              filtered.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">{admin.full_name}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>{statusBadge(admin.status)}</TableCell>
                  <TableCell>{new Date(admin.created_at).toLocaleDateString("vi-VN")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditAdmin(admin); setEditName(admin.full_name || ""); setEditEmail(admin.email); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setResetAdmin(admin); setResetPw(""); setResetConfirm(""); }}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      {admin.status === "locked" ? (
                        <Button variant="ghost" size="icon" onClick={() => { setUnlockAdmin(admin); setUnlockType("permanent"); setUnlockDate(""); }}>
                          <Unlock className="h-4 w-4 text-success" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" onClick={() => handleLock(admin)} disabled={submitting}>
                          <Lock className="h-4 w-4 text-warning" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(admin)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editAdmin} onOpenChange={(open) => !open && setEditAdmin(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Họ tên</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEdit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetAdmin} onOpenChange={(open) => !open && setResetAdmin(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đặt lại mật khẩu cho {resetAdmin?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mật khẩu mới</Label>
              <Input type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Xác nhận mật khẩu</Label>
              <Input type="password" value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleResetPassword} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Đặt lại
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock Dialog */}
      <Dialog open={!!unlockAdmin} onOpenChange={(open) => !open && setUnlockAdmin(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mở khóa {unlockAdmin?.full_name}</DialogTitle>
            <DialogDescription>Chọn kiểu mở khóa</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={unlockType === "permanent" ? "default" : "outline"} onClick={() => setUnlockType("permanent")} size="sm">
                Mở khóa vĩnh viễn
              </Button>
              <Button variant={unlockType === "timed" ? "default" : "outline"} onClick={() => setUnlockType("timed")} size="sm">
                Đặt thời hạn
              </Button>
            </div>
            {unlockType === "timed" && (
              <div className="space-y-2">
                <Label>Khóa lại vào</Label>
                <Input type="datetime-local" value={unlockDate} onChange={(e) => setUnlockDate(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleUnlock} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
