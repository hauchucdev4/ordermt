/**
 * ODA3_0100 — Data hook: danh sách nhà hàng của Admin đang đăng nhập (+ CRUD).
 * Quy chuẩn ROADMAP 1.4: mọi truy vấn Supabase nằm ở hook, không nằm ở pages/*.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

type Options = { ownerId?: string; orderBy?: "created_at" | "name" };

export function useMyRestaurants(options: Options = {}) {
  const { user } = useAuth();
  const ownerId = options.ownerId ?? user?.id;
  const orderBy = options.orderBy ?? "created_at";

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    const { data } = await supabase
      .from("restaurants")
      .select("*")
      .eq("admin_id", ownerId)
      .order(orderBy, { ascending: orderBy === "name" });
    setRestaurants(data ?? []);
    setLoading(false);
  }, [ownerId, orderBy]);

  useEffect(() => {
    if (!ownerId) return;
    refresh();
  }, [ownerId, refresh]);

  const createRestaurant = useCallback(
    async (name: string, address: string | null) => {
      if (!ownerId) return { error: new Error("Thiếu tài khoản admin") };
      const { error } = await supabase
        .from("restaurants")
        .insert({ name, address, admin_id: ownerId });
      if (!error) await refresh();
      return { error };
    },
    [ownerId, refresh],
  );

  const updateRestaurant = useCallback(
    async (id: string, name: string, address: string | null) => {
      const { error } = await supabase.from("restaurants").update({ name, address }).eq("id", id);
      if (!error) await refresh();
      return { error };
    },
    [refresh],
  );

  const deleteRestaurant = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("restaurants").delete().eq("id", id);
      if (!error) await refresh();
      return { error };
    },
    [refresh],
  );

  return { restaurants, loading, refresh, createRestaurant, updateRestaurant, deleteRestaurant };
}
