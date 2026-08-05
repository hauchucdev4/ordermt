/** ODA2_0200 — UI: danh sách Admin chờ duyệt. */
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAdminApprovals } from "@/hooks/useAdminApprovals";
import { Check, X, Loader2, UserCheck } from "lucide-react";

export default function AdminApprovalList() {
  const { pending, loading, approve, reject } = useAdminApprovals();
  const { toast } = useToast();

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <UserCheck className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Không có yêu cầu nào đang chờ duyệt</p>
        </CardContent>
      </Card>
    );
  }

  return (
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
              <Button
                size="sm"
                className="flex-1"
                onClick={async () => {
                  await approve(admin.id);
                  toast({ title: `Đã duyệt ${admin.full_name}` });
                }}
              >
                <Check className="mr-1 h-4 w-4" /> Duyệt
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={async () => {
                  await reject(admin.id);
                  toast({ title: `Đã từ chối ${admin.full_name}` });
                }}
              >
                <X className="mr-1 h-4 w-4" /> Từ chối
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
