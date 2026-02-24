"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, BellOff } from "lucide-react";

interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  metadata_: Record<string, unknown> | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  budget_warning: "Budget Warning",
  budget_exceeded: "Budget Exceeded",
  statement_due: "Statement Due",
};

function NotificationTypeBadge({ type }: { type: string }) {
  const label = TYPE_LABELS[type] ?? type;
  const cls =
    type === "budget_exceeded"
      ? "bg-accent-red-dim text-accent-red"
      : type === "budget_warning"
        ? "bg-accent-amber-dim text-accent-amber"
        : type === "statement_due"
          ? "bg-accent-blue-dim text-accent-blue"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  );
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<{ items: NotificationItem[]; total: number }>("/notifications");
      setNotifications(data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function markAllRead() {
    try {
      await api.patch("/notifications/read-all", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      await load();
    }
  }

  async function markRead(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      await load();
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">Budget alerts and payment reminders</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <BellOff className="h-4 w-4 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center space-y-3">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="text-lg font-medium">All caught up</p>
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
          <ul className="divide-y divide-border">
            {notifications.map((n) => {
              const inner = (
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      {!n.is_read && (
                        <span className="shrink-0 h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <NotificationTypeBadge type={n.type} />
                    <p className="text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleDateString("en-PH")}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.is_read ? (
                    <div className="px-5 py-3.5">{inner}</div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      className="w-full text-left px-5 py-3.5 transition-colors bg-muted/40 hover:bg-muted/60"
                    >
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
