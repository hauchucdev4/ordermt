/**
 * ODA2_0200 — Data hook: duyệt đăng ký Admin (Superadmin).
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function useAdminApprovals() {
  const [pending, setPending] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "admin")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setPending(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const approve = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "active" as const })
        .eq("id", id);
      if (!error) await refresh();
      return { error };
    },
    [refresh],
  );

  const reject = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (!error) await refresh();
      return { error };
    },
    [refresh],
  );

  return { pending, loading, refresh, approve, reject };
}
