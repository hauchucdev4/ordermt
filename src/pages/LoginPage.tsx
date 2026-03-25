import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { UtensilsCrossed, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { signIn, signUp, signOut, profile, loading, user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && profile) {
    if (profile.status === "pending") {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Card className="w-full max-w-md animate-fade-in">
            <CardHeader className="text-center">
              <UtensilsCrossed className="mx-auto h-10 w-10 text-accent" />
              <CardTitle className="text-xl">Chờ phê duyệt</CardTitle>
              <CardDescription>
                Tài khoản của bạn đang chờ SuperAdmin phê duyệt. Vui lòng quay lại sau.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={() => signOut()}>
                Đăng xuất
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    if (profile.status === "locked") {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Card className="w-full max-w-md animate-fade-in">
            <CardHeader className="text-center">
              <CardTitle className="text-xl text-destructive">Tài khoản bị khóa</CardTitle>
              <CardDescription>
                Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      );
    }
    // Redirect based on role
    const roleRoutes: Record<string, string> = {
      superadmin: "/superadmin",
      admin: "/admin",
      manager: "/manager",
      staff: "/staff",
      chef: "/chef",
    };
    return <Navigate to={roleRoutes[profile.role] || "/"} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsSubmitting(false);
    if (error) {
      toast({ title: "Đăng nhập thất bại", description: error.message, variant: "destructive" });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirm) {
      toast({ title: "Lỗi", description: "Mật khẩu xác nhận không khớp", variant: "destructive" });
      return;
    }
    if (regPassword.length < 8) {
      toast({ title: "Lỗi", description: "Mật khẩu tối thiểu 8 ký tự", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const { error } = await signUp(regEmail, regPassword, regName, "admin");
    setIsSubmitting(false);
    if (error) {
      toast({ title: "Đăng ký thất bại", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đăng ký thành công", description: "Tài khoản đang chờ SuperAdmin phê duyệt." });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <UtensilsCrossed className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">OrderMaster</h1>
          <p className="text-sm text-muted-foreground">Hệ thống Quản lý Nhà hàng</p>
        </div>

        <Card>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Đăng nhập</TabsTrigger>
              <TabsTrigger value="register">Đăng ký Admin</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin}>
                <CardHeader>
                  <CardTitle className="text-lg">Đăng nhập</CardTitle>
                  <CardDescription>Nhập email và mật khẩu để tiếp tục</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="email@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Mật khẩu</Label>
                    <Input id="login-password" type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Đăng nhập
                  </Button>
                </CardContent>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister}>
                <CardHeader>
                  <CardTitle className="text-lg">Đăng ký tài khoản Admin</CardTitle>
                  <CardDescription>Tài khoản sẽ chờ SuperAdmin phê duyệt</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Họ tên</Label>
                    <Input id="reg-name" required value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Nguyễn Văn A" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input id="reg-email" type="email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="email@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Mật khẩu</Label>
                    <Input id="reg-password" type="password" required value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Tối thiểu 8 ký tự" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm">Xác nhận mật khẩu</Label>
                    <Input id="reg-confirm" type="password" required value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)} placeholder="Nhập lại mật khẩu" />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Đăng ký
                  </Button>
                </CardContent>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
