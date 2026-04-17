import { createContext, useCallback, useContext, useState, ReactNode } from "react";

export type NotificationItem = {
  id: string;
  title: string;
  description?: string;
  type: "new" | "update" | "info";
  createdAt: number;
  read: boolean;
};

type NotificationContextValue = {
  items: NotificationItem[];
  unreadCount: number;
  pushNotification: (item: Omit<NotificationItem, "id" | "createdAt" | "read">) => void;
  markAllRead: () => void;
  clearAll: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const MAX_ITEMS = 30;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>([]);

  const pushNotification = useCallback((item: Omit<NotificationItem, "id" | "createdAt" | "read">) => {
    setItems((prev) => {
      const next: NotificationItem = {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        read: false,
      };
      return [next, ...prev].slice(0, MAX_ITEMS);
    });
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
  }, []);

  const clearAll = useCallback(() => setItems([]), []);

  const unreadCount = items.filter((i) => !i.read).length;

  return (
    <NotificationContext.Provider value={{ items, unreadCount, pushNotification, markAllRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    return {
      items: [] as NotificationItem[],
      unreadCount: 0,
      pushNotification: () => {},
      markAllRead: () => {},
      clearAll: () => {},
    } satisfies NotificationContextValue;
  }
  return ctx;
}
