import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Loader2, UserCheck } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default function AdminApprovals() {
  const [pending, setPending] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPending = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "admin")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setPending(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPending(); }, []);

  const handleApprove = async (admin: Profile) => {
    await supabase.from("profiles").update({ status: "active" as const }).eq("id", admin.id);
    toast({ title: `Đã duyệt ${admin.full_name}` });
    fetchPending();
  };

  const handleReject = async (admin: Profile) => {
    await supabase.from("profiles").delete().eq("id", admin.id);
    toast({ title: `Đã từ chối ${admin.full_name}` });
    fetchPending();
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Duyệt đăng ký Admin</h1>

      {pending.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Không có yêu cầu nào đang chờ duyệt</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pending.map((admin) => (
            <Card key={admin.id} className="animate-fade-in">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{admin.full_name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{admin.email}</p>
                  </div>
                  <Badge variant="secondary">Chờ duyệt</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-4">
                  Đăng ký: {new Date(admin.created_at).toLocaleDateString("vi-VN")}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => handleApprove(admin)}>
                    <Check className="mr-1 h-4 w-4" /> Duyệt
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleReject(admin)}>
                    <X className="mr-1 h-4 w-4" /> Từ chối
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
