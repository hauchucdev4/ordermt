import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, KeyRound } from "lucide-react";

export default function AccountSettings() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [saving, setSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã lưu thay đổi" });
      refreshProfile();
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) {
      toast({ title: "Lỗi", description: "Mật khẩu mới tối thiểu 8 ký tự", variant: "destructive" });
      return;
    }
    if (newPw !== confirmPw) {
      toast({ title: "Lỗi", description: "Mật khẩu xác nhận không khớp", variant: "destructive" });
      return;
    }
    setChangingPw(true);
    // Verify current password by re-signing in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile?.email || "",
      password: currentPw,
    });
    if (signInError) {
      setChangingPw(false);
      toast({ title: "Lỗi", description: "Mật khẩu hiện tại không đúng", variant: "destructive" });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setChangingPw(false);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đổi mật khẩu thành công" });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Cài đặt tài khoản</h1>

      <Card>
        <form onSubmit={handleSaveProfile}>
          <CardHeader>
            <CardTitle className="text-lg">Thông tin cá nhân</CardTitle>
            <CardDescription>Cập nhật thông tin hồ sơ của bạn</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Họ tên</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile.email} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Số điện thoại</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Tùy chọn" />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Vai trò:</span>
                <span className="ml-2 font-medium capitalize">{profile.role}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Ngày tạo:</span>
                <span className="ml-2 font-medium">{new Date(profile.created_at).toLocaleDateString("vi-VN")}</span>
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Lưu thay đổi
            </Button>
          </CardContent>
        </form>
      </Card>

      <Card>
        <form onSubmit={handleChangePassword}>
          <CardHeader>
            <CardTitle className="text-lg">Đổi mật khẩu</CardTitle>
            <CardDescription>Thay đổi mật khẩu đăng nhập</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Mật khẩu hiện tại</Label>
              <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Mật khẩu mới</Label>
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required placeholder="Tối thiểu 8 ký tự" />
            </div>
            <div className="space-y-2">
              <Label>Xác nhận mật khẩu mới</Label>
              <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
            </div>
            <Button type="submit" disabled={changingPw}>
              {changingPw ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Đổi mật khẩu
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
