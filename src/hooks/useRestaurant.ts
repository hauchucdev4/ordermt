/**
 * ODA3_0100 — Data hook: 1 nhà hàng theo id, và tên nhà hàng theo id.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

export function useRestaurant(id?: string) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase.from("restaurants").select("*").eq("id", id).single();
      if (!active) return;
      setRestaurant(data ?? null);
      setError(err ? "Không tìm thấy nhà hàng" : null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  return { restaurant, loading, error };
}

export function useRestaurantName(id?: string | null) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(Boolean(id));

  useEffect(() => {
    if (!id) {
      setName("");
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("restaurants").select("name").eq("id", id).single();
      if (!active) return;
      setName(data?.name ?? "Nhà hàng");
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  return { name, loading };
}
