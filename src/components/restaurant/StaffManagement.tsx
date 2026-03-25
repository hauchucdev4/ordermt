import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Loader2, Trash2, Edit, KeyRound, Users } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];

const STAFF_ROLES: { value: AppRole; label: string }[] = [
  { value: "manager", label: "Quản lý" },
  { value: "staff", label: "Nhân viên" },
  { value: "chef", label: "Đầu bếp" },
];

export default function StaffManagement({ restaurantId }: { restaurantId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>("all");

  // Add staff dialog
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("staff");
  const [submitting, setSubmitting] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  // Reset password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fetchStaff = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .in("role", ["manager", "staff", "chef"])
      .order("created_at", { ascending: false });
    setStaff(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchStaff(); }, [restaurantId]);

  const handleAddStaff = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) return;
    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("admin-create-user", {
      body: { email: email.trim(), password, fullName: name.trim(), role, restaurantId },
    });
    setSubmitting(false);
    if (res.error || res.data?.error) {
      toast({ title: "Lỗi", description: res.data?.error || res.error?.message, variant: "destructive" });
    } else {
      toast({ title: "Đã thêm nhân viên" });
      setAddOpen(false);
      setName(""); setEmail(""); setPassword(""); setRole("staff");
      fetchStaff();
    }
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: editName.trim(), email: editEmail.trim() })
      .eq("id", editTarget.id);
    setSubmitting(false);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã cập nhật" });
      setEditOpen(false);
      fetchStaff();
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || newPassword.length < 8 || newPassword !== confirmPassword) return;
    setSubmitting(true);
    const res = await supabase.functions.invoke("admin-reset-password", {
      body: { userId: resetTarget.id, newPassword },
    });
    setSubmitting(false);
    if (res.error || res.data?.error) {
      toast({ title: "Lỗi", description: res.data?.error || res.error?.message, variant: "destructive" });
    } else {
      toast({ title: "Đã đặt lại mật khẩu" });
      setResetOpen(false);
      setNewPassword(""); setConfirmPassword("");
    }
  };

  const handleDelete = async (p: Profile) => {
    if (!confirm(`Xóa nhân viên "${p.full_name}"?`)) return;
    await supabase.from("profiles").delete().eq("id", p.id);
    toast({ title: "Đã xóa nhân viên" });
    fetchStaff();
  };

  const filtered = filterRole === "all" ? staff : staff.filter((s) => s.role === filterRole);

  const roleLabel = (r: string) => STAFF_ROLES.find((sr) => sr.value === r)?.label || r;
  const roleBadgeVariant = (r: string) => {
    if (r === "manager") return "default" as const;
    if (r === "chef") return "secondary" as const;
    return "outline" as const;
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {STAFF_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Thêm nhân viên</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Thêm nhân viên mới</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Họ tên</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nhanvien@email.com" />
              </div>
              <div className="space-y-2">
                <Label>Mật khẩu</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tối thiểu 8 ký tự" />
              </div>
              <div className="space-y-2">
                <Label>Vai trò</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAFF_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddStaff} disabled={submitting || !name.trim() || !email.trim() || password.length < 8}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Thêm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Chưa có nhân viên nào</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell><Badge variant={roleBadgeVariant(p.role)}>{roleLabel(p.role)}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={p.status === "active" ? "default" : "secondary"}>
                      {p.status === "active" ? "Hoạt động" : p.status === "locked" ? "Đã khóa" : "Chờ duyệt"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditTarget(p); setEditName(p.full_name || ""); setEditEmail(p.email); setEditOpen(true); }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setResetTarget(p); setResetOpen(true); }}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Chỉnh sửa thông tin</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Họ tên</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
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
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Đặt lại mật khẩu cho {resetTarget?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mật khẩu mới</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Tối thiểu 8 ký tự" />
            </div>
            <div className="space-y-2">
              <Label>Xác nhận mật khẩu</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Nhập lại mật khẩu" />
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-sm text-destructive">Mật khẩu không khớp</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleResetPassword} disabled={submitting || newPassword.length < 8 || newPassword !== confirmPassword}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Đặt lại
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
