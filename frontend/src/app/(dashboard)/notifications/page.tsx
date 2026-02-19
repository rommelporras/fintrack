"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setNotifications(await api.get<NotificationItem[]>("/notifications"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function markAllRead() {
    await api.patch("/notifications/read-all", {});
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`, {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
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
        <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
          <Bell className="h-8 w-8" />
          <p className="text-sm">No notifications yet.</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors",
                    !n.is_read && "bg-muted/40"
                  )}
                  onClick={() => !n.is_read && markRead(n.id)}
                >
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
                      <Badge variant="secondary" className="text-xs">
                        {TYPE_LABELS[n.type] ?? n.type}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {new Date(n.created_at).toLocaleDateString("en-PH")}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
