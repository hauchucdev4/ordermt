/** ODA2_0300 — Page: chỉ layout. */
import CreateAdminForm from "@/components/superadmin/CreateAdminForm";

export default function CreateAdmin() {
  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Tạo tài khoản Admin</h1>
      <CreateAdminForm />
    </div>
  );
}
