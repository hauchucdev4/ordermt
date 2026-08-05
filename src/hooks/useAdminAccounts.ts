/**
 * ODA2_0100 — Data hook: quản lý tài khoản Admin (Superadmin).
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function useAdminAccounts() {
  const [admins, setAdmins] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "admin")
      .order("created_at", { ascending: false });
    setAdmins(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const lockAdmin = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "locked" as const, lock_until: null })
        .eq("id", id);
      if (!error) await refresh();
      return { error };
    },
    [refresh],
  );

  const unlockAdmin = useCallback(
    async (id: string, lockUntil: string | null) => {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "active" as const, lock_until: lockUntil })
        .eq("id", id);
      if (!error) await refresh();
      return { error };
    },
    [refresh],
  );

  const updateAdmin = useCallback(
    async (id: string, fullName: string, email: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, email })
        .eq("id", id);
      if (!error) await refresh();
      return { error };
    },
    [refresh],
  );

  const deleteAdmin = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (!error) await refresh();
      return { error };
    },
    [refresh],
  );

  const resetPassword = useCallback(async (userId: string, newPassword: string) => {
    const { error } = await supabase.functions.invoke("admin-reset-password", {
      body: { userId, newPassword },
    });
    return { error };
  }, []);

  return { admins, loading, refresh, lockAdmin, unlockAdmin, updateAdmin, deleteAdmin, resetPassword };
}
