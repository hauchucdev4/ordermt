import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { playRealtimeAlert, primeRealtimeAudio } from "@/lib/realtimeAlerts";
import { useNotifications } from "@/contexts/NotificationContext";

type RestaurantScope = {
  ids: string[];
  names: Record<string, string>;
};

const STATUS_LABELS: Record<string, string> = {
  new: "Món mới",
  preparing: "Đang làm",
  done: "Hoàn thành",
};

export default function RestaurantRealtimeNotifier() {
  const { profile } = useAuth();
  const location = useLocation();
  const { pushNotification } = useNotifications();
  const [scope, setScope] = useState<RestaurantScope>({ ids: [], names: {} });
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const recentEventsRef = useRef<Map<string, number>>(new Map());

  const isKitchenScreen = location.pathname.includes("/kitchen") || location.pathname.startsWith("/chef");
  const scopeKey = useMemo(() => scope.ids.slice().sort().join("|"), [scope.ids]);

  useEffect(() => {
    let active = true;

    const loadScope = async () => {
      if (!profile || profile.role === "superadmin" || profile.role === "chef") {
        if (active) setScope({ ids: [], names: {} });
        return;
      }

      if (profile.role === "admin") {
        const { data } = await supabase.from("restaurants").select("id, name").eq("admin_id", profile.id);
        if (!active) return;

        const restaurants = data || [];
        setScope({
          ids: restaurants.map((restaurant) => restaurant.id),
          names: Object.fromEntries(restaurants.map((restaurant) => [restaurant.id, restaurant.name])),
        });
        return;
      }

      if (profile.restaurant_id) {
        const { data } = await supabase.from("restaurants").select("id, name").eq("id", profile.restaurant_id).single();
        if (!active) return;

        setScope({
          ids: data ? [data.id] : [profile.restaurant_id],
          names: data ? { [data.id]: data.name } : {},
        });
        return;
      }

      if (active) setScope({ ids: [], names: {} });
    };

    void loadScope();

    return () => {
      active = false;
    };
  }, [profile]);

  useEffect(() => {
    if (!profile || !scope.ids.length || profile.role === "superadmin" || profile.role === "chef") {
      return;
    }

    const detachAudioPrime = primeRealtimeAudio();

    const rememberEvent = (key: string) => {
      recentEventsRef.current.set(key, Date.now());
      const now = Date.now();
      for (const [eventKey, timestamp] of recentEventsRef.current.entries()) {
        if (now - timestamp > 10000) recentEventsRef.current.delete(eventKey);
      }
    };

    const notifyStatusChange = async (itemId: string, previousStatus?: string, nextStatus?: string) => {
      if (!itemId || !nextStatus || previousStatus === nextStatus) return;

      const eventKey = `${itemId}:${previousStatus ?? "unknown"}:${nextStatus}`;
      if (recentEventsRef.current.has(eventKey)) return;
      rememberEvent(eventKey);

      const { data } = await supabase
        .from("order_items")
        .select("id, status, quantity, menu_items(name), orders!inner(restaurant_id, table_id, tables:table_id(name))")
        .eq("id", itemId)
        .single();

      const restaurantId = (data as any)?.orders?.restaurant_id as string | undefined;
      if (!restaurantId || !scope.ids.includes(restaurantId)) return;

      const menuName = (data as any)?.menu_items?.name || "Món ăn";
      const tableName = (data as any)?.orders?.tables?.name || "Bàn";
      const restaurantName = scope.names[restaurantId];

      const description = [restaurantName, tableName, menuName].filter(Boolean).join(" • ");
      const statusLabel = STATUS_LABELS[nextStatus] || nextStatus;

      // Always push to notification bell + play sound, regardless of current screen
      pushNotification({
        type: "update",
        title: `Bếp: ${statusLabel} - ${menuName}`,
        description,
      });
      playRealtimeAlert("update");

      // Only show toast on non-kitchen screens to avoid noise for chef
      if (!isKitchenScreen) {
        toast(`Bếp đã cập nhật: ${statusLabel}`, { description });
      }
    };

    const notifyNewItem = async (itemId: string) => {
      if (!itemId) return;
      const eventKey = `new:${itemId}`;
      if (recentEventsRef.current.has(eventKey)) return;
      rememberEvent(eventKey);

      const { data } = await supabase
        .from("order_items")
        .select("id, quantity, menu_items(name), orders!inner(restaurant_id, tables:table_id(name))")
        .eq("id", itemId)
        .single();

      const restaurantId = (data as any)?.orders?.restaurant_id as string | undefined;
      if (!restaurantId || !scope.ids.includes(restaurantId)) return;

      const menuName = (data as any)?.menu_items?.name || "Món ăn";
      const tableName = (data as any)?.orders?.tables?.name || "Bàn";
      const qty = (data as any)?.quantity || 1;
      const restaurantName = scope.names[restaurantId];
      const description = [restaurantName, tableName, `${qty}x ${menuName}`].filter(Boolean).join(" • ");

      if (!isKitchenScreen) {
        toast(`Món mới được đặt`, { description });
      }
      pushNotification({
        type: "new",
        title: `Món mới: ${qty}x ${menuName}`,
        description,
      });
      playRealtimeAlert("new");
    };

    const setupChannel = () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);

      channelRef.current = supabase
        .channel(`restaurant-global-alerts-${profile.id}-${scopeKey}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "order_items" }, (payload) => {
          const previousStatus = (payload.old as { status?: string } | null)?.status;
          const nextStatus = (payload.new as { id?: string; status?: string } | null)?.status;
          const itemId = (payload.new as { id?: string } | null)?.id;
          if (!itemId) return;

          void notifyStatusChange(itemId, previousStatus, nextStatus);
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_items" }, (payload) => {
          const itemId = (payload.new as { id?: string } | null)?.id;
          if (!itemId) return;
          void notifyNewItem(itemId);
        })
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setTimeout(setupChannel, 3000);
          }
        });
    };

    setupChannel();

    const heartbeat = setInterval(() => {
      if (!channelRef.current) return;
      supabase.removeChannel(channelRef.current);
      setupChannel();
    }, 5 * 60 * 1000);

    return () => {
      detachAudioPrime();
      clearInterval(heartbeat);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [isKitchenScreen, profile, scope.ids, scope.names, scopeKey, pushNotification]);

  return null;
}