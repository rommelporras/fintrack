"use client";
import { useEffect } from "react";
import { subscribePush } from "@/lib/push";

export function PushPrompt() {
  useEffect(() => {
    if (!("Notification" in window) || !("PushManager" in window)) return;
    if (Notification.permission !== "default") return;
    const timer = setTimeout(() => {
      subscribePush().catch(() => {});
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
