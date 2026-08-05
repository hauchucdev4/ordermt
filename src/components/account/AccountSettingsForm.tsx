/**
 * ODA1_0200 — UI: Cài đặt tài khoản (thông tin cá nhân + đổi mật khẩu).
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAccountProfile } from "@/hooks/useAccountProfile";
import { Loader2, Save, KeyRound, Upload, ArrowLeft } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  manager: "Quản lý",
  staff: "Nhân viên",
  chef: "Đầu bếp",
};

const HOME_BY_ROLE: Record<string, string> = {
  chef: "/chef",
  staff: "/staff",
  manager: "/manager",
  admin: "/admin",
  superadmin: "/superadmin",
};

export default function AccountSettingsForm() {
  const { profile, uploadAvatar, saveProfile, changePassword } = useAccountProfile();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  if (!profile) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { error } = await uploadAvatar(file);
    setUploading(false);
    if (error) toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    else toast({ title: "Đã cập nhật ảnh đại diện" });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await saveProfile(fullName, phone);
    setSaving(false);
    if (error) toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    else toast({ title: "Đã lưu thay đổi" });
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
    const { error } = await changePassword(currentPw, newPw);
    setChangingPw(false);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Đổi mật khẩu thành công" });
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
  };

  const initials = profile.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";
  const backHref = HOME_BY_ROLE[profile.role] || "/";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Cài đặt tài khoản</h1>
        <Button asChild variant="outline" size="sm">
          <Link to={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại
          </Link>
        </Button>
      </div>

      <Card>
        <form onSubmit={handleSaveProfile}>
          <CardHeader>
            <CardTitle className="text-lg">Thông tin cá nhân</CardTitle>
            <CardDescription>Cập nhật thông tin hồ sơ của bạn</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <Label
                  htmlFor="avatar-upload"
                  className="cursor-pointer inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Đang tải..." : "Thay đổi ảnh đại diện"}
                </Label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
              </div>
            </div>

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
                <span className="ml-2 font-medium">{ROLE_LABELS[profile.role] || profile.role}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Ngày tạo:</span>
                <span className="ml-2 font-medium">
                  {new Date(profile.created_at).toLocaleDateString("vi-VN")}
                </span>
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
              <Input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                required
                placeholder="Tối thiểu 8 ký tự"
              />
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
