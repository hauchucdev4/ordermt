/** ODA2_0200 — Page: chỉ layout. */
import AdminApprovalList from "@/components/superadmin/AdminApprovalList";

export default function AdminApprovals() {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Duyệt đăng ký Admin</h1>
      <AdminApprovalList />
    </div>
  );
}
