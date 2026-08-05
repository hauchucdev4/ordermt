/**
 * ODA2_0300 — Data hook: tạo tài khoản Admin qua edge function (service role).
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CreateAdminInput = {
  email: string;
  password: string;
  fullName: string;
  lockUntil: string | null;
};

export function useCreateAdminAccount() {
  const createAdmin = useCallback(async (input: CreateAdminInput) => {
    const { error } = await supabase.functions.invoke("admin-create-user", {
      body: { ...input, role: "admin" },
    });
    return { error };
  }, []);

  return { createAdmin };
}
