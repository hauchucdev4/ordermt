import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus } from "lucide-react";

export default function CreateAdmin() {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [useLockDate, setUseLockDate] = useState(false);
  const [lockDate, setLockDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Lỗi", description: "Mật khẩu tối thiểu 8 ký tự", variant: "destructive" });
      return;
    }
    if (password !== confirmPw) {
      toast({ title: "Lỗi", description: "Mật khẩu không khớp", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    // Create via edge function to bypass auth
    const { error } = await supabase.functions.invoke("admin-create-user", {
      body: {
        email,
        password,
        fullName,
        role: "admin",
        lockUntil: useLockDate && lockDate ? new Date(lockDate).toISOString() : null,
      },
    });

    setSubmitting(false);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã tạo tài khoản Admin mới" });
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPw("");
      setUseLockDate(false);
      setLockDate("");
    }
  };

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Tạo tài khoản Admin</h1>

      <Card>
        <form onSubmit={handleCreate}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Thông tin Admin mới
            </CardTitle>
            <CardDescription>Tài khoản sẽ được kích hoạt ngay</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Họ tên</Label>
              <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Mật khẩu</Label>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tối thiểu 8 ký tự" />
            </div>
            <div className="space-y-2">
              <Label>Xác nhận mật khẩu</Label>
              <Input type="password" required value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="lock-date" checked={useLockDate} onChange={(e) => setUseLockDate(e.target.checked)} className="rounded" />
              <Label htmlFor="lock-date" className="cursor-pointer">Đặt thời hạn tài khoản</Label>
            </div>
            {useLockDate && (
              <div className="space-y-2">
                <Label>Tài khoản sẽ tự khóa vào</Label>
                <Input type="datetime-local" value={lockDate} onChange={(e) => setLockDate(e.target.value)} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Tạo tài khoản
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
